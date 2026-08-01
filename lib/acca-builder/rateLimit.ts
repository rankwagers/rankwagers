import { rateLimit, type RateLimitResult } from "@/lib/security/rateLimit";

export const ACCA_BUILDER_GENERATE_LIMIT = 20;
export const ACCA_BUILDER_RATE_WINDOW_MS = 60_000;

export function rateLimitAccaBuilder(input: {
  clientKey: string;
  now?: number;
}): RateLimitResult {
  return rateLimit({
    key: `acca-builder:generate:${input.clientKey}`,
    limit: ACCA_BUILDER_GENERATE_LIMIT,
    windowMs: ACCA_BUILDER_RATE_WINDOW_MS,
    now: input.now,
  });
}
