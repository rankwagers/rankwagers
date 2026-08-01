import { rateLimit, type RateLimitResult } from "@/lib/security/rateLimit";

export const COMBO_GENERATE_LIMIT = 30;
export const COMBO_REPLACE_LIMIT = 40;
export const COMBO_REMOVE_LIMIT = 40;
export const COMBO_OPERATORS_LIMIT = 60;
export const COMBO_DIAGNOSTICS_LIMIT = 60;
export const COMBO_RATE_WINDOW_MS = 60_000;

/** Reusable combo rate-limit interface over the shared in-memory limiter. */
export function rateLimitCombo(input: {
  action: "generate" | "replace" | "remove" | "operators" | "diagnostics";
  clientKey: string;
  now?: number;
}): RateLimitResult {
  const limits: Record<typeof input.action, number> = {
    generate: COMBO_GENERATE_LIMIT,
    replace: COMBO_REPLACE_LIMIT,
    remove: COMBO_REMOVE_LIMIT,
    operators: COMBO_OPERATORS_LIMIT,
    diagnostics: COMBO_DIAGNOSTICS_LIMIT,
  };
  return rateLimit({
    key: `combo:${input.action}:${input.clientKey}`,
    limit: limits[input.action],
    windowMs: COMBO_RATE_WINDOW_MS,
    now: input.now,
  });
}
