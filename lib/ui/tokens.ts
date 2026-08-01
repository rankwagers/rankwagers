/**
 * Design token names for web + future Flutter parity.
 * Values live in `app/globals.css` `:root`. Do not hardcode hex in new UI.
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

export const RADIUS = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  full: "var(--radius-full)",
} as const;

export const ELEVATION = {
  card: "var(--shadow-card)",
  elevated: "var(--shadow-elevated)",
  focus: "var(--shadow-focus)",
} as const;

export type StatusTone = "won" | "lost" | "void" | "pending" | "live";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  won: "bg-[var(--status-won-bg)] text-[var(--status-won-fg)]",
  lost: "bg-[var(--status-lost-bg)] text-[var(--status-lost-fg)]",
  void: "bg-[var(--status-void-bg)] text-[var(--status-void-fg)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)]",
  live: "bg-[var(--status-live-bg)] text-[var(--status-live-fg)]",
};

export type RiskTone =
  | "low_risk"
  | "balanced"
  | "aggressive"
  | "very_aggressive";

export const RISK_TONE_CLASS: Record<RiskTone, string> = {
  low_risk: "bg-[var(--risk-low-bg)] text-[var(--risk-low-fg)]",
  balanced: "bg-[var(--risk-balanced-bg)] text-[var(--risk-balanced-fg)]",
  aggressive: "bg-[var(--risk-aggressive-bg)] text-[var(--risk-aggressive-fg)]",
  very_aggressive:
    "bg-[var(--risk-very-aggressive-bg)] text-[var(--risk-very-aggressive-fg)]",
};

/** Minimum interactive target — WCAG-oriented touch comfort. */
export const TOUCH_TARGET_CLASS = "min-h-[var(--touch-min)] min-w-[var(--touch-min)]";

export const MOTION = {
  fast: "var(--motion-fast)",
  base: "var(--motion-base)",
  slow: "var(--motion-slow)",
  easeOut: "var(--ease-out)",
} as const;
