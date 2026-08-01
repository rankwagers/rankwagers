/**
 * Browser-safe presentation helpers for the evidence archive.
 *
 * Client Components must import from HERE, never from `@/lib/evidence` (the barrel) or
 * `hash.ts` / `snapshot.ts` / `integrity.ts`, all of which pull in `node:crypto`.
 *
 * Class strings map onto the Design Bible CSS variables already used by
 * `lib/evidence-ui/tokens.ts`, so archive UI sits visually inside the existing system
 * without depending on that module.
 */

import type {
  BestOddsSnapshot,
  EvidenceQualification,
  EvidenceScoreBand,
  OperatorAvailabilitySnapshot,
  ValidationState,
} from "@/types/evidence";

export const evidenceArchiveTokens = {
  section: "border-t border-[var(--border-subtle)] pt-8",
  /*
   * Re-pointed at the shared primitives (spec 8/11). These were a second card and a second
   * badge implementation living beside the ones in globals.css: same intent, different radius
   * and border token, so evidence surfaces drifted from every other card on the site. The
   * recipes are gone; only the surface that differs (a muted card sits on page canvas, not
   * card canvas) is still expressed here, as a utility override.
   */
  card: "card card-compact",
  cardMuted: "card card-compact bg-background",
  label: "text-metadata font-medium uppercase tracking-label text-muted-foreground",
  value: "font-mono text-lg font-semibold text-foreground",
  note: "text-xs leading-snug text-muted-foreground",
  mono: "font-mono text-metadata text-muted-foreground",
  badge: "badge",
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,currentColor)]",
  touchTarget: "min-h-11 min-w-11",
} as const;

/** Short display form for content hashes. */
export function shortHash(hash: string, length = 12): string {
  return hash.slice(0, length);
}

export function qualificationBadgeClass(value: EvidenceQualification): string {
  switch (value) {
    case "qualified":
      return "border-[var(--green-primary)]/30 bg-[var(--green-surface)] text-[var(--green-deep)]";
    case "provisional":
      return "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]";
    case "unqualified":
      return "border-border bg-[var(--canvas-secondary)] text-foreground";
    case "excluded":
      return "border-[var(--red-primary)]/25 bg-[var(--red-surface)] text-[var(--red-primary)]";
  }
}

export function scoreBandClass(band: EvidenceScoreBand): string {
  switch (band) {
    case "high":
      return "border-[var(--green-primary)]/30 bg-[var(--green-surface)] text-[var(--green-deep)]";
    case "moderate":
      return "border-border bg-[var(--canvas-secondary)] text-foreground";
    case "low":
      return "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]";
    case "insufficient":
      return "border-[var(--red-primary)]/25 bg-[var(--red-surface)] text-[var(--red-primary)]";
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
      return "border-[var(--green-primary)]/30 bg-[var(--green-surface)] text-[var(--green-deep)]";
    case "lost":
      return "border-[var(--red-primary)]/25 bg-[var(--red-surface)] text-[var(--red-primary)]";
    case "pending":
      return "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]";
    case "void":
    case "cancelled":
    case "postponed":
    case "abandoned":
      return "border-border bg-[var(--canvas-secondary)] text-muted-foreground";
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
