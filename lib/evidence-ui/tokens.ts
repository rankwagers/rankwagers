import type { BaselineRelation, EvidenceStrength } from "./types";

/** Shared presentation tokens mapped to Design Bible CSS variables. */
export const evidenceUiTokens = {
  section: "border-b border-[var(--border-subtle)] py-8",
  card: "rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-3",
  cardMuted: "rounded-md border border-border bg-[var(--canvas-primary)] px-3 py-3",
  label: "text-metadata font-medium uppercase tracking-label text-muted-foreground",
  value: "font-mono text-lg font-semibold text-foreground",
  note: "text-xs leading-snug text-muted-foreground",
  stickyNav:
    "sticky top-14 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-border bg-[var(--canvas-primary)]/95 px-4 py-2 backdrop-blur md:top-16",
  touchTarget: "min-h-11 min-w-11",
} as const;

export function strengthBadgeClass(strength: EvidenceStrength): string {
  switch (strength) {
    case "very_strong":
    case "strong":
      return "border-[var(--green-primary)]/30 bg-[var(--green-surface)] text-[var(--green-deep)]";
    case "moderate":
      return "border-border bg-[var(--canvas-secondary)] text-foreground";
    case "limited":
      return "border-[var(--amber-border)] bg-[var(--amber-surface)] text-[var(--amber-primary)]";
    case "insufficient":
      return "border-[var(--red-primary)]/25 bg-[var(--red-surface)] text-[var(--red-primary)]";
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
