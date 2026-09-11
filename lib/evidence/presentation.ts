/**
 * Browser-safe presentation helpers for the evidence archive.
 *
 * Client Components must import from HERE, never from `@/lib/evidence` (the barrel) or
 * `hash.ts` / `snapshot.ts` / `integrity.ts`, all of which pull in `node:crypto`.
 *
 * Class strings map onto the Bible V3 rw3 custom properties (`--line`, `--surface`,
 * `--win`, `--loss`, `--muted`, …) scoped in `app/globals.css`, so archive UI sits
 * visually inside the v3 system without depending on any other token module.
 */

import type {
  BestOddsSnapshot,
  EvidenceQualification,
  EvidenceScoreBand,
  OperatorAvailabilitySnapshot,
  ValidationState,
} from "@/types/evidence";

export const evidenceArchiveTokens = {
  section: "border-t border-[var(--line)] pt-8",
  /*
   * Re-pointed at the shared primitives (spec 8/11), then re-derived for Bible V3: the
   * v2 `.card` recipe carried its own radius and shadow, both retired under rw3. A card
   * is a `--line` border on `--surface`, radius 6, no elevation; only the surface that
   * differs (a muted card sits on page canvas, not card canvas) is still expressed here.
   */
  card: "border border-[var(--line)] bg-[var(--surface)] p-3 [border-radius:6px]",
  cardMuted: "border border-[var(--line)] bg-[var(--bg)] p-3 [border-radius:6px]",
  label: "rw3-label",
  value: "text-[16px] font-semibold tabular-nums",
  note: "rw3-meta leading-snug",
  mono: "rw3-meta tabular-nums",
  badge:
    "inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[.06em] [border-radius:6px]",
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--text)]",
  touchTarget: "min-h-11 min-w-11",
} as const;

/** Short display form for content hashes. */
export function shortHash(hash: string, length = 12): string {
  return hash.slice(0, length);
}

export function qualificationBadgeClass(value: EvidenceQualification): string {
  switch (value) {
    case "qualified":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--win)]";
    case "provisional":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--muted)]";
    case "unqualified":
      return "border-[var(--line)] bg-transparent text-[var(--text)]";
    case "excluded":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--loss)]";
  }
}

export function scoreBandClass(band: EvidenceScoreBand): string {
  switch (band) {
    case "high":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--win)]";
    case "moderate":
      return "border-[var(--line)] bg-transparent text-[var(--text)]";
    case "low":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--muted)]";
    case "insufficient":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--loss)]";
  }
}

/**
 * Colour for a validation state.
 *
 * The four unscored states (`void`, `cancelled`, `postponed`, `abandoned`) deliberately
 * share a neutral treatment — showing them as failures would misrepresent the record.
 */
export function validationBadgeClass(state: ValidationState): string {
  switch (state) {
    case "won":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--win)]";
    case "lost":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--loss)]";
    case "pending":
      return "border-[var(--line)] bg-[var(--pctbg)] text-[var(--muted)]";
    case "void":
    case "cancelled":
    case "postponed":
    case "abandoned":
      return "border-[var(--line)] bg-transparent text-[var(--muted)]";
  }
}

/**
 * Stable, locale-aware timestamp label.
 *
 * Falls back to the raw ISO string rather than throwing or printing "Invalid Date" —
 * an archive row with an odd timestamp should still be legible.
 */
export function formatCapturedAt(iso: string | null, locale = "en"): string {
  if (!iso) return "Time unavailable";
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(parsed));
  } catch {
    return new Date(parsed).toISOString();
  }
}

export function formatEvidenceScore(score: number): string {
  return score.toFixed(1);
}

/** Signed delta, e.g. `+4.2` / `−1.0`. Returns an em-dash when there is no prior. */
export function formatScoreDelta(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "±0.0";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toFixed(1)}`;
}

export function operatorAvailabilityLabel(
  availability: OperatorAvailabilitySnapshot | null
): string {
  if (!availability) return "Operator coverage not captured";
  const { availableOperators, totalOperators, restrictedCountries } = availability;
  const base = `${availableOperators} of ${totalOperators} operators available`;
  if (!restrictedCountries.length) return base;
  return `${base} · restricted in ${restrictedCountries.length} market${
    restrictedCountries.length === 1 ? "" : "s"
  }`;
}

export function bestOddsLabel(odds: BestOddsSnapshot | null): string {
  if (!odds || odds.decimalOdds === null) return "No price captured";
  const operator = odds.operatorKey ? ` at ${odds.operatorKey}` : "";
  return `${odds.decimalOdds.toFixed(2)}${operator} · ${odds.sampleOperators} priced`;
}
