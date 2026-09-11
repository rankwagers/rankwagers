/**
 * Design token names for web + future Flutter parity.
 * V3: values follow Bible V3 (docs/design/bible-v3.md) — the rw3 scope in
 * `app/globals.css` defines the custom properties. Do not hardcode hex in new UI.
 */

export const SPACE = {
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  8: "var(--space-8)",
  10: "var(--space-10)",
  12: "var(--space-12)",
  touchMin: "var(--touch-min)",
} as const;

/* Bible V3: one radius — 6px. `full` remains for the rare circular element
 * (form dots, the sheet grab handle). */
export const RADIUS = {
  sm: "6px",
  md: "6px",
  lg: "6px",
  xl: "6px",
  full: "9999px",
} as const;

/* Bible V3: shadows none, ever. A surface that needs separation gets a line
 * (`1px solid var(--line)`), not an elevation; focus is the scope's
 * 2px outline in `--text`. */
export const ELEVATION = {
  card: "none",
  elevated: "none",
  focus: "none",
} as const;

export type StatusTone = "won" | "lost" | "void" | "pending" | "live";

/* Live coloring law: win/positive `--win`, loss/negative `--loss`, live/on-air
 * `--accent`, neutral `--muted`. Quiet chips on `--pctbg`; colour rides on text. */
export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  won: "bg-[var(--pctbg)] text-[var(--win)]",
  lost: "bg-[var(--pctbg)] text-[var(--loss)]",
  void: "bg-[var(--pctbg)] text-[var(--muted)]",
  pending: "bg-[var(--pctbg)] text-[var(--muted)]",
  live: "bg-[var(--pctbg)] text-[var(--accent)]",
};

export type RiskTone =
  | "low_risk"
  | "balanced"
  | "aggressive"
  | "very_aggressive";

export const RISK_TONE_CLASS: Record<RiskTone, string> = {
  low_risk: "bg-[var(--pctbg)] text-[var(--win)]",
  balanced: "bg-[var(--pctbg)] text-[var(--text)]",
  aggressive: "bg-[var(--pctbg)] text-[var(--muted)]",
  very_aggressive: "bg-[var(--pctbg)] text-[var(--loss)]",
};

/** Minimum interactive target — WCAG-oriented touch comfort. */
export const TOUCH_TARGET_CLASS = "min-h-[var(--touch-min)] min-w-[var(--touch-min)]";

/* Bible V3 motion law: hover 120ms, pressed 60ms, longest movement 240ms,
 * all ease-out. */
export const MOTION = {
  fast: "60ms",
  base: "120ms",
  slow: "240ms",
  easeOut: "ease-out",
} as const;
