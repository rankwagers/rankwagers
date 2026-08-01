/**
 * Rate limiting — process-local fixed window (single PM2 instance).
 *
 * Deployment assumption: one Node process. Memory buckets are sufficient.
 * Keep {@link RateLimiter} so a Postgres/Redis adapter can be swapped later
 * without changing call sites.
 */

import { logWarn } from "@/lib/monitoring/logger";
import { metrics } from "@/lib/observability/metrics";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  code?: "rate_limited" | "limiter_unavailable";
};

export type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

/** Adapter interface — memory today; remote store later if multi-instance. */
export type RateLimiter = {
  readonly mode: "memory" | "remote";
  check(input: RateLimitInput): RateLimitResult;
  reset?(): void;
};

export type RateLimitFailMode = "fail_open" | "fail_closed";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let multiInstanceWarned = false;

/** Simple in-memory fixed window limiter (single Node process / PM2 instance). */
export function rateLimit(input: RateLimitInput): RateLimitResult {
  const now = input.now ?? Date.now();
  const existing = buckets.get(input.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterSec: Math.ceil(input.windowMs / 1000),
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      code: "rate_limited",
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, input.limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export const memoryRateLimiter: RateLimiter = {
  mode: "memory",
  check: rateLimit,
  reset: () => {
    buckets.clear();
  },
};

let activeLimiter: RateLimiter = memoryRateLimiter;

export function getRateLimiter(): RateLimiter {
  return activeLimiter;
}

export function setRateLimiter(next: RateLimiter): void {
  activeLimiter = next;
}

export function getRateLimiterMode(): {
  adapter: "memory" | "remote";
  singleInstanceAssumed: boolean;
} {
  return {
    adapter: activeLimiter.mode,
    singleInstanceAssumed: activeLimiter.mode === "memory",
  };
}

/**
 * Route policy when the limiter adapter itself throws.
 * - combo: fail-open + metric
 * - diagnostics/cron/postback: fail-closed
 * - affiliate redirect: fail-open (never block safe redirect on limiter failure)
 */
export function checkRateLimitSafe(
  input: RateLimitInput & {
    route: string;
    onAdapterFailure: RateLimitFailMode;
  }
): RateLimitResult {
  try {
    const result = getRateLimiter().check(input);
    if (!result.allowed) {
      metrics.increment("rate_limit_rejected_total", { route: input.route });
    }
    return result;
  } catch (err) {
    metrics.increment("rate_limit_rejected_total", {
      route: input.route,
      reason: "adapter_failure",
    });
    logWarn(
      "rate_limiter_adapter_failure",
      {
        route: input.route,
        mode: input.onAdapterFailure,
        message: err instanceof Error ? err.message : "unknown",
      },
      "rate_limit"
    );
    if (input.onAdapterFailure === "fail_closed") {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: 30,
        code: "limiter_unavailable",
      };
    }
    return {
      allowed: true,
      remaining: input.limit,
      retryAfterSec: 0,
      code: "limiter_unavailable",
    };
  }
}

export function warnIfMultiInstanceMemoryLimiter(): void {
  if (multiInstanceWarned) return;
  const instances = Number(process.env.PM2_INSTANCES ?? process.env.WEB_CONCURRENCY ?? "1");
  if (activeLimiter.mode === "memory" && Number.isFinite(instances) && instances > 1) {
    multiInstanceWarned = true;
    logWarn(
      "memory_rate_limiter_multi_instance",
      {
        instances,
        detail:
          "Memory rate limiter assumes a single Node process. Shared limiter required for horizontal scale.",
      },
      "rate_limit"
    );
  }
}

export function clientKey(req: {
  headers: Headers;
  ip?: string | null;
}): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  return cf || realIp || forwarded || req.ip || "unknown";
}

/** Test helper */
export function resetRateLimitBuckets(): void {
  buckets.clear();
  activeLimiter = memoryRateLimiter;
  multiInstanceWarned = false;
}
