import "server-only";
import { readTrackedAnalyticsEvents } from "@/lib/analytics/fileProvider";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import { AFFILIATE_RULE_VERSION } from "./contracts";
import { buildOperatorRegistry } from "./operators";
import { AFFILIATE_PLACEMENTS } from "./placements";
import { buildCampaignInventory } from "./campaigns";
import { buildAffiliateFunnels } from "./funnels";
import { buildRedirectHealth } from "./redirects";
import { detectAffiliateIssues } from "./issues";
import { diagnoseRedirectContracts } from "./diagnostics";
import {
  buildOperatorQualityRows,
  buildPlacementQualityRows,
} from "./quality";

export type AffiliateAuditSnapshot = {
  generatedAt: string;
  ruleVersion: string;
  events: AnalyticsEvent[];
  operators: ReturnType<typeof buildOperatorRegistry>;
  placements: typeof AFFILIATE_PLACEMENTS;
  campaigns: ReturnType<typeof buildCampaignInventory>;
  funnels: ReturnType<typeof buildAffiliateFunnels>;
  redirects: ReturnType<typeof buildRedirectHealth>;
  issues: ReturnType<typeof detectAffiliateIssues>;
  diagnostics: ReturnType<typeof diagnoseRedirectContracts>;
  operatorQuality: ReturnType<typeof buildOperatorQualityRows>;
  placementQuality: ReturnType<typeof buildPlacementQualityRows>;
};

/** Bounded analytics window — do not rescan unbounded logs on every hot path without cache. */
export async function loadAffiliateAuditSnapshot(opts?: {
  eventLimit?: number;
  country?: string | null;
}): Promise<AffiliateAuditSnapshot> {
  const generatedAt = new Date().toISOString();
  const events = await readTrackedAnalyticsEvents(opts?.eventLimit ?? 50_000);
  const operators = buildOperatorRegistry(opts?.country ?? null);
  const campaigns = buildCampaignInventory();
  const funnels = buildAffiliateFunnels(events);
  const redirects = buildRedirectHealth(events);
  const issues = detectAffiliateIssues(operators, generatedAt);
  const diagnostics = diagnoseRedirectContracts();
  const operatorQuality = buildOperatorQualityRows(operators);
  const placementQuality = buildPlacementQualityRows(
    AFFILIATE_PLACEMENTS,
    new Map()
  );

  return {
    generatedAt,
    ruleVersion: AFFILIATE_RULE_VERSION,
    events,
    operators,
    placements: AFFILIATE_PLACEMENTS,
    campaigns,
    funnels,
    redirects,
    issues,
    diagnostics,
    operatorQuality,
    placementQuality,
  };
}
