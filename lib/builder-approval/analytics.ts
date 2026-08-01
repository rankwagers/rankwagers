/**
 * Internal admin analytics for Builder publication candidates (Sprint 20B-A).
 *
 * Follows the existing admin convention (`lib/experimentation/analytics.ts`): a local event
 * union emitted on a dedicated server-side channel. These are internal operational events,
 * not visitor-facing conversion events, so they are deliberately NOT added to
 * `lib/analytics/types.ts` (which types the public client-side event surface).
 *
 * Safe dimensions only. Never emit the payload, selections, legs, source config, signed
 * URLs, tokens, credentials or personal data. No revenue, FTD or betting-outcome claim is
 * ever derived from a candidate.
 */

export type BuilderApprovalAnalyticsEvent =
  | "builder_candidate_created"
  | "builder_candidate_create_failed"
  | "builder_candidate_viewed";

export type BuilderApprovalAnalyticsProperties = {
  /** Candidate schema version. */
  schemaVersion?: string;
  /** "memory" | "postgres" — storage adapter in use. */
  storageMode?: string;
  /** Number of legs in the stored combination. A count only, never the legs. */
  legCount?: number;
  /** Source list date (YYYY-MM-DD). Not personal data. */
  sourceDate?: string | null;
  /** Coarse failure category, e.g. "validation" | "idempotency_conflict". */
  failureCategory?: string;
  /** True when a retry resolved to an existing candidate. */
  deduplicated?: boolean;
  /** Candidate id — a random opaque identifier, safe to correlate internally. */
  candidateId?: string;
};

const ALLOWED_PROPERTY_KEYS: readonly string[] = [
  "schemaVersion",
  "storageMode",
  "legCount",
  "sourceDate",
  "failureCategory",
  "deduplicated",
  "candidateId",
];

/**
 * Emit an internal analytics event. Unknown properties are dropped rather than forwarded,
 * so a future caller cannot accidentally widen the surface into payload data.
 */
export function trackBuilderApprovalEvent(
  event: BuilderApprovalAnalyticsEvent,
  properties: BuilderApprovalAnalyticsProperties = {},
): void {
  if (process.env.NODE_ENV === "test") return;

  const safe: Record<string, string | number | boolean | null> = {};
  for (const key of ALLOWED_PROPERTY_KEYS) {
    const value = (properties as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      safe[key] = value;
    }
  }

  console.info(
    JSON.stringify({
      channel: "builder_approval_analytics",
      event,
      properties: safe,
      ts: new Date().toISOString(),
    }),
  );
}
