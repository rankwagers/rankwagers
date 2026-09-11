import type { BaselineRelation, EvidenceStrength } from "./types";

/**
 * Shared presentation tokens mapped to the rw3 scope's CSS variables (Bible V3).
 *
 * Enclosure is tonal, not drawn. `card` carries the only border in the evidence surface — a
 * hairline at the subtle step — and everything nested inside it separates by background tone
 * alone. A bordered box inside a bordered box reads as a form; tone inside a hairline reads as a
 * page.
 */
export const evidenceUiTokens = {
  section: "border-b border-[var(--line)] py-8",
  card: "border border-[var(--line)] bg-[var(--surface)] p-5 [border-radius:6px]",
  /** Nested block. Deliberately borderless: it sits inside `card` and is separated by tone. */
  cardMuted: "bg-[var(--bg)] p-4 [border-radius:6px]",
  label: "rw3-label",
  /** The focal figure of a card. Tabular so a column of values shares one optical rhythm. */
  value: "text-[16px] font-semibold leading-none tabular-nums",
  note: "text-[12px] leading-relaxed text-[var(--muted)]",
  stickyNav:
    "sticky top-14 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-[var(--line)] bg-[var(--bg)] px-4 py-2 md:top-16",
  touchTarget: "min-h-11 min-w-11",
} as const;

/**
 * Evidence strength, expressed in tone rather than hue.
 *
 * Strength is not an outcome. Green/amber/red here competed directly with the settlement palette —
 * a "strong" chip and a "won" badge rendered the same green, so colour meant two things on one
 * card. The scale now descends through ink weight: inverted ink is strongest, plain canvas is
 * weakest. Chroma inside evidence content is reserved for won · lost · void · pending.
 */
export function strengthBadgeClass(strength: EvidenceStrength): string {
  switch (strength) {
    case "very_strong":
    case "strong":
      return "bg-[var(--text)] text-[var(--bg)]";
    case "moderate":
      return "bg-[var(--pctbg)] text-[var(--text)]";
    case "limited":
      return "bg-[var(--pctbg)] text-[var(--muted)]";
    case "insufficient":
      return "bg-transparent text-[var(--muted)]";
  }
}

export function baselineRelationLabel(relation: BaselineRelation): string {
  switch (relation) {
    case "above":
      return "Above baseline";
    case "near":
      return "Near baseline";
    case "below":
      return "Below baseline";
    case "unavailable":
      return "Baseline unavailable";
  }
}
