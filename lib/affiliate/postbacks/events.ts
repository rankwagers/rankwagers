import { Pool } from "pg";
import { reportError } from "@/lib/monitoring/logger";

export type PostbackEventRecord = {
  operatorId: string;
  eventType: string;
  clickId?: string;
  externalTransactionId?: string;
  status: string;
  reason?: string;
  payloadHash?: string;
  rawReferenceHash?: string;
  receivedAt?: string;
};

export type PostbackEventStore = {
  append(event: PostbackEventRecord): Promise<void>;
};

export function createMemoryPostbackEventStore(): PostbackEventStore & {
  list(): PostbackEventRecord[];
} {
  const events: PostbackEventRecord[] = [];
  return {
    async append(event) {
      events.push({
        ...event,
        receivedAt: event.receivedAt ?? new Date().toISOString(),
      });
    },
    list() {
      return [...events];
    },
  };
}

export function createPostgresPostbackEventStore(
  connectionString: string
): PostbackEventStore {
  const pool = new Pool({ connectionString, max: 5 });
  return {
    async append(event) {
      await pool.query(
        `INSERT INTO postback_events (
          operator_id, event_type, click_id, external_transaction_id,
          status, reason, payload_hash, raw_reference_hash, received_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          event.operatorId,
          event.eventType,
          event.clickId ?? null,
          event.externalTransactionId ?? null,
          event.status,
          event.reason ?? null,
          event.payloadHash ?? null,
          event.rawReferenceHash ?? null,
          event.receivedAt ?? new Date().toISOString(),
        ]
      );
    },
  };
}

let store: PostbackEventStore = createMemoryPostbackEventStore();
let wired = false;

function wireDefaultStore(): void {
  if (wired) return;
  wired = true;
  if (process.env.ATTRIBUTION_ADAPTER?.trim().toLowerCase() === "memory") {
    return;
  }
  const url =
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  if (url) {
    store = createPostgresPostbackEventStore(url);
  }
}

export function getPostbackEventStore(): PostbackEventStore {
  wireDefaultStore();
  return store;
}

export function setPostbackEventStore(next: PostbackEventStore): void {
  store = next;
  wired = true;
}

export function resetPostbackEventStore(): void {
  store = createMemoryPostbackEventStore();
  wired = true;
}

/** Best-effort append — never throws to callers. */
export async function recordPostbackEvent(
  event: PostbackEventRecord
): Promise<void> {
  try {
    await getPostbackEventStore().append(event);
  } catch (err) {
    reportError(err, "postback_events", {
      operatorId: event.operatorId,
      status: event.status,
    });
  }
}
