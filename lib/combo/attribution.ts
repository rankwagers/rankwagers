import { createHash, randomBytes } from "node:crypto";
import { reportError, logWarn } from "@/lib/monitoring/logger";
import { getMonitoring } from "@/lib/monitoring/provider";
import { metrics } from "@/lib/observability/metrics";
/*
 * Static import. The previous lazy require carried a comment about avoiding a circular import,
 * but attribution-postgres imports from this module with import type only, which TypeScript
 * erases — so there is no cycle at runtime to avoid. pg is loaded when this module loads; no
 * pool is constructed until createPostgresAttributionStore(url) is called, so no connection is
 * opened by the import itself.
 */
import { createPostgresAttributionStore } from "./attribution-postgres";

export type AffiliateClickRecord = {
  clickId: string;
  sessionId?: string;
  comboId?: string;
  operatorId: string;
  country?: string;
  locale: string;
  placement: string;
  operatorRank?: number;
  targetOddsMin?: number;
  targetOddsMax?: number;
  actualComboOdds?: number;
  operatorComboOdds?: number;
  selectionCount?: number;
  marketTypes?: string[];
  evidenceStrength?: string;
  availability: "full" | "partial" | "unknown" | "none";
  deeplinkType: string;
  campaignId?: string;
  offerId?: string;
  createdAt: string;
  idempotencyKey?: string;
};

export type AffiliateConversionRecord = {
  conversionId: string;
  operatorId: string;
  clickId?: string;
  externalTransactionId?: string;
  type: string;
  amount?: number;
  currency?: string;
  occurredAt: string;
  receivedAt: string;
  status: "accepted" | "rejected" | "duplicate";
  attributed: boolean;
  rawReferenceHash?: string;
};

export type AttributionStore = {
  createClick(
    record: AffiliateClickRecord
  ): Promise<{ created: boolean; record: AffiliateClickRecord }>;
  getClick(clickId: string): Promise<AffiliateClickRecord | null>;
  createConversion(
    record: AffiliateConversionRecord
  ): Promise<{ created: boolean; record: AffiliateConversionRecord }>;
  listConversions(): Promise<AffiliateConversionRecord[]>;
  purgeExpired(now?: number): Promise<number>;
  stats(): Promise<AttributionStoreStats>;
};

export type AttributionStoreStats = {
  clickCount: number;
  conversionCount: number;
  attributedConversions: number;
  unattributedConversions: number;
  adapter: string;
};

const DEFAULT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export function createMemoryAttributionStore(options?: {
  retentionMs?: number;
}): AttributionStore {
  const retentionMs = options?.retentionMs ?? DEFAULT_RETENTION_MS;
  const clicks = new Map<string, AffiliateClickRecord>();
  const byIdempotency = new Map<string, string>();
  const conversions = new Map<string, AffiliateConversionRecord>();
  const byExternal = new Map<string, string>();

  return {
    async createClick(record) {
      if (record.idempotencyKey) {
        const existingId = byIdempotency.get(record.idempotencyKey);
        if (existingId) {
          const existing = clicks.get(existingId);
          if (existing) return { created: false, record: existing };
        }
      }
      if (clicks.has(record.clickId)) {
        return { created: false, record: clicks.get(record.clickId)! };
      }
      clicks.set(record.clickId, record);
      if (record.idempotencyKey) {
        byIdempotency.set(record.idempotencyKey, record.clickId);
      }
      return { created: true, record };
    },
    async getClick(clickId) {
      return clicks.get(clickId) ?? null;
    },
    async createConversion(record) {
      if (record.externalTransactionId) {
        const key = `${record.operatorId}:${record.externalTransactionId}`;
        const existingId = byExternal.get(key);
        if (existingId) {
          const existing = conversions.get(existingId);
          if (existing) {
            return {
              created: false,
              record: { ...existing, status: "duplicate" },
            };
          }
        }
        byExternal.set(key, record.conversionId);
      }
      conversions.set(record.conversionId, record);
      return { created: true, record };
    },
    async listConversions() {
      return [...conversions.values()];
    },
    async purgeExpired(now = Date.now()) {
      let removed = 0;
      for (const [id, click] of clicks) {
        if (now - Date.parse(click.createdAt) > retentionMs) {
          clicks.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
    async stats() {
      const conversionList = [...conversions.values()];
      return {
        clickCount: clicks.size,
        conversionCount: conversionList.length,
        attributedConversions: conversionList.filter((c) => c.attributed).length,
        unattributedConversions: conversionList.filter((c) => !c.attributed)
          .length,
        adapter: "memory",
      };
    },
  };
}

function createDefaultAttributionStore(): AttributionStore {
  const forced = process.env.ATTRIBUTION_ADAPTER?.trim().toLowerCase();
  if (forced === "memory") {
    return createMemoryAttributionStore();
  }
  const url =
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  if (!url) {
    return createMemoryAttributionStore();
  }
  return createPostgresAttributionStore(url);
}

let store: AttributionStore | null = null;
let storePinned = false;

export function getAttributionStore(): AttributionStore {
  if (!store) {
    store = createDefaultAttributionStore();
  }
  return store;
}

export function setAttributionStore(next: AttributionStore): void {
  store = next;
  storePinned = true;
}

export function resetAttributionStore(): void {
  store = createMemoryAttributionStore();
  storePinned = true;
}

/** Test helper — allow re-resolving default adapter from env. */
export function clearAttributionStorePin(): void {
  store = null;
  storePinned = false;
}

export function newClickId(): string {
  return `clk_${randomBytes(12).toString("hex")}`;
}

export function hashReference(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

/** @deprecated Use createAffiliateClick — kept for Phase A/B export compat. */
export type ComboAttributionClick = {
  click_id: string;
  session_id: string;
  combo_id: string;
  operator_id: string;
  country?: string;
  placement: string;
  campaign_id?: string;
  offer_id?: string;
  created_at: string;
};

/** @deprecated */
export function buildAttributionStub(input: {
  sessionId: string;
  comboId: string;
  operatorId: string;
  country?: string;
  placement?: string;
  offerId?: string;
}): ComboAttributionClick {
  const created_at = new Date().toISOString();
  const click_id = newClickId();
  return {
    click_id,
    session_id: input.sessionId,
    combo_id: input.comboId,
    operator_id: input.operatorId,
    country: input.country,
    placement: input.placement ?? "combo_studio",
    offer_id: input.offerId,
    created_at,
  };
}

/**
 * Persist click attribution.
 * On store failure: log + metrics, still return the ephemeral record.
 * Callers (e.g. /go) must always continue redirect.
 */
export async function createAffiliateClick(
  input: Omit<AffiliateClickRecord, "clickId" | "createdAt"> & {
    clickId?: string;
  }
): Promise<{ created: boolean; record: AffiliateClickRecord }> {
  const record: AffiliateClickRecord = {
    ...input,
    clickId: input.clickId ?? newClickId(),
    createdAt: new Date().toISOString(),
  };
  // Strip forbidden fields if somehow present
  const safe = { ...record } as AffiliateClickRecord & {
    ip?: unknown;
    userAgent?: unknown;
    email?: unknown;
  };
  delete safe.ip;
  delete safe.userAgent;
  delete safe.email;
  try {
    return await getAttributionStore().createClick(safe);
  } catch (err) {
    metrics.increment("attribution_write_failure_total", {
      operatorId: safe.operatorId,
    });
    reportError(err, "attribution", {
      clickId: safe.clickId,
      operatorId: safe.operatorId,
      placement: safe.placement,
    });
    logWarn("attribution_write_failed_continue_redirect", {
      clickId: safe.clickId,
      operatorId: safe.operatorId,
      pinned: storePinned,
    }, "attribution");
    try {
      getMonitoring().captureMessage("attribution_write_failed", "warning", {
        clickId: safe.clickId,
        operatorId: safe.operatorId,
      });
    } catch {
      // Monitoring failure must not block redirect.
    }
    return { created: false, record: safe };
  }
}
