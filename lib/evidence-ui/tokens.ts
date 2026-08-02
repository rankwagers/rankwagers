import type { BaselineRelation, EvidenceStrength } from "./types";

/**
 * Shared presentation tokens mapped to Design Bible CSS variables.
 *
 * Enclosure is tonal, not drawn. `card` carries the only border in the evidence surface — a
 * hairline at the subtle step — and everything nested inside it separates by background tone
 * alone. A bordered box inside a bordered box reads as a form; tone inside a hairline reads as a
 * page.
 */
export const evidenceUiTokens = {
  section: "border-b border-[var(--border-subtle)] py-8",
  card: "rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] p-5",
  /** Nested block. Deliberately borderless: it sits inside `card` and is separated by tone. */
  cardMuted: "rounded-lg bg-[var(--canvas-primary)] p-4",
  label: "text-metadata font-medium uppercase tracking-label text-muted-foreground",
  /** The focal figure of a card. Tabular so a column of values shares one optical rhythm. */
  value: "font-mono text-2xl font-semibold leading-none tabular-nums text-foreground",
  note: "text-caption leading-relaxed text-muted-foreground",
  stickyNav:
    "sticky top-14 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-border bg-[var(--canvas-primary)]/95 px-4 py-2 backdrop-blur md:top-16",
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
      return "bg-[var(--ink-primary)] text-[var(--canvas-primary)]";
    case "moderate":
      return "bg-[var(--canvas-primary)] text-foreground";
    case "limited":
      return "bg-[var(--canvas-primary)] text-[var(--ink-secondary)]";
    case "insufficient":
      return "bg-transparent text-muted-foreground";
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
