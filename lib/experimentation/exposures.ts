export type ExposureRecord = {
  experimentId: string;
  experimentVersion: string;
  variantId: string;
  /** Safe derived key — never raw IP */
  assignmentKeyHash: string;
  exposureUnitType: string;
  pageType: string | null;
  locale: string | null;
  timestamp: string;
  requestId: string | null;
  dedupeKey: string;
  metricVersion: string;
  environment: string;
  preview: boolean;
  meaningfulRender: boolean;
};

export type DedupeMode = "first_exposure" | "first_per_session" | "first_per_day";

export const DEFAULT_ANALYSIS_DEDUPE: DedupeMode = "first_exposure";

export function buildDedupeKey(input: {
  experimentId: string;
  assignmentKeyHash: string;
  variantId: string;
  mode?: DedupeMode;
  sessionId?: string | null;
  day?: string | null;
}): string {
  const mode = input.mode ?? DEFAULT_ANALYSIS_DEDUPE;
  if (mode === "first_per_session") {
    return `${input.experimentId}|${input.assignmentKeyHash}|${input.sessionId ?? "nosession"}|${input.variantId}`;
  }
  if (mode === "first_per_day") {
    return `${input.experimentId}|${input.assignmentKeyHash}|${input.day ?? "noday"}|${input.variantId}`;
  }
  return `${input.experimentId}|${input.assignmentKeyHash}|${input.variantId}`;
}

/** Only record when meaningful render occurred and not preview/production-contaminating. */
export function shouldLogExposure(input: {
  eligible: boolean;
  meaningfulRender: boolean;
  preview: boolean;
  alreadySeenDedupeKey: boolean;
}): { log: boolean; reason: string } {
  if (!input.eligible) return { log: false, reason: "not_eligible" };
  if (!input.meaningfulRender) {
    return { log: false, reason: "assignment_only_no_render" };
  }
  if (input.preview) return { log: false, reason: "preview_isolated" };
  if (input.alreadySeenDedupeKey) {
    return { log: false, reason: "duplicate_exposure" };
  }
  return { log: true, reason: "first_valid_exposure" };
}

export function filterPrimaryAnalysisExposures(
  records: ExposureRecord[],
): ExposureRecord[] {
  const seen = new Set<string>();
  const out: ExposureRecord[] = [];
  const sorted = [...records]
    .filter((r) => !r.preview && r.meaningfulRender)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const r of sorted) {
    if (seen.has(r.dedupeKey)) continue;
    seen.add(r.dedupeKey);
    out.push(r);
  }
  return out;
}
