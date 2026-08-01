export type FreshnessVerdict = {
  ok: boolean | null;
  label: string;
  notes: string[];
};

/** Conservative freshness — Unavailable when timestamps missing. */
export function assessFreshness(input: {
  lastMeaningfulUpdate: string | null;
  kickoffAt: string | null;
  pageType: string;
  maxAgeDays?: number;
}): FreshnessVerdict {
  const maxAge = input.maxAgeDays ?? 180;
  const ts = input.lastMeaningfulUpdate || input.kickoffAt;
  if (!ts) {
    return {
      ok: null,
      label: "Unavailable",
      notes: ["No last-update or kickoff timestamp in audit inputs"],
    };
  }
  const ageMs = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ageMs)) {
    return { ok: null, label: "Unavailable", notes: ["Invalid timestamp"] };
  }
  const ageDays = ageMs / (86_400_000);
  if (
    (input.pageType === "fixture" || input.pageType === "archive_day") &&
    ageDays > maxAge
  ) {
    return {
      ok: false,
      label: "stale",
      notes: [`Age ${Math.round(ageDays)}d exceeds ${maxAge}d without confirmed archive value`],
    };
  }
  return {
    ok: true,
    label: "fresh_enough",
    notes: [`ageDays≈${Math.round(ageDays)}`],
  };
}
