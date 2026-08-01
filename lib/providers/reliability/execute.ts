import { logWarn } from "@/lib/monitoring/logger";
import { metrics } from "@/lib/observability/metrics";
import {
  canProbe,
  recordFailure,
  recordSuccess,
} from "./circuit-breaker";
import {
  ProviderError,
  classifyHttpStatus,
  classifyThrown,
} from "./errors";
import { computeBackoffDelayMs, retryFor, timeoutFor } from "./policy";
import {
  parseQuotaFromHeaders,
  rememberQuota,
  shouldSkipForQuota,
} from "./quota";
import type { ProviderCallContext, QuotaState } from "./types";
import { noteProviderOutcome } from "./health";
import {
  maybeCaptureRawResponse,
  maybeCaptureRawFailure,
} from "@/lib/providers/raw-archive/capture";

export type ProviderExecuteResult<T> = {
  data: T;
  attempts: number;
  durationMs: number;
  quota?: QuotaState;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeSignals(
  timeoutSignal: AbortSignal,
  external?: AbortSignal
): AbortSignal {
  if (!external) return timeoutSignal;
  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return AbortSignal.any([timeoutSignal, external]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (timeoutSignal.aborted || external.aborted) {
    controller.abort();
    return controller.signal;
  }
  timeoutSignal.addEventListener("abort", onAbort, { once: true });
  external.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

/**
 * Execute an upstream fetch with timeout, bounded retry, circuit breaker, and metrics.
 */
export async function executeProviderCall<T>(
  ctx: ProviderCallContext & {
    interactive?: boolean;
    fetch: (signal: AbortSignal) => Promise<Response>;
    parse: (res: Response) => Promise<T>;
  }
): Promise<ProviderExecuteResult<T>> {
  const started = Date.now();
  const timeout = timeoutFor(ctx.operation);
  const retry = retryFor(ctx.operation, { interactive: ctx.interactive });

  metrics.increment("provider_request_total", {
    provider: ctx.provider,
    operation: ctx.operation,
  });

  if (shouldSkipForQuota(ctx.provider)) {
    const err = new ProviderError({
      code: "quota_exhausted",
      provider: ctx.provider,
      operation: ctx.operation,
      message: "Provider quota exhausted",
      retryable: false,
    });
    noteProviderOutcome(ctx.provider, ctx.operation, err);
    metrics.increment("provider_error_total", {
      provider: ctx.provider,
      code: "quota_exhausted",
    });
    throw err;
  }

  const probe = canProbe(ctx.provider, ctx.operation);
  if (!probe.allowed) {
    const err = new ProviderError({
      code: "circuit_open",
      provider: ctx.provider,
      operation: ctx.operation,
      message: `Circuit open for ${ctx.provider}:${ctx.operation}`,
      retryable: false,
    });
    noteProviderOutcome(ctx.provider, ctx.operation, err);
    metrics.increment("provider_error_total", {
      provider: ctx.provider,
      code: "circuit_open",
    });
    throw err;
  }

  let attempts = 0;
  let lastError: ProviderError | null = null;
  const deadline = started + retry.maxTotalRetryMs;

  while (attempts < retry.maxAttempts) {
    attempts += 1;
    if (attempts > 1 && Date.now() > deadline) break;

    if (attempts > 1) {
      const delay = computeBackoffDelayMs(attempts, retry);
      metrics.increment("provider_retry_total", {
        provider: ctx.provider,
        operation: ctx.operation,
      });
      logWarn(
        "provider_retry",
        {
          provider: ctx.provider,
          operation: ctx.operation,
          attempt: attempts,
          delayMs: delay,
          reason: lastError?.code ?? "unknown",
        },
        "provider"
      );
      if (delay > 0) await sleep(delay);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout.timeoutMs);
    const signal = mergeSignals(controller.signal, ctx.signal);

    const fetchStartedAt = Date.now();
    try {
      const res = await ctx.fetch(signal);
      const responseDurationMs = Date.now() - fetchStartedAt;
      const quota = parseQuotaFromHeaders(res.headers);
      rememberQuota(ctx.provider, quota);

      // Raw Provider Archive (Sprint 23B) — capture EVERY response (ok + non-ok) with its response
      // timing. DORMANT by default (flag off ⇒ no-op, no clone, no I/O); fail-open (never throws /
      // never alters this call). Clones synchronously here, before `ctx.parse(res)` consumes the body.
      maybeCaptureRawResponse(
        { provider: ctx.provider, operation: ctx.operation, endpoint: ctx.endpoint },
        res,
        { attempts, durationMs: responseDurationMs }
      );

      if (!res.ok) {
        const classified = classifyHttpStatus(res.status);
        const err = new ProviderError({
          code: classified.code,
          provider: ctx.provider,
          operation: ctx.operation,
          message: `HTTP ${res.status}`,
          retryable: classified.retryable,
          status: res.status,
          details: { timeoutMs: timeout.timeoutMs, attempt: attempts },
        });
        if (quota.exhausted) {
          throw new ProviderError({
            code: "quota_exhausted",
            provider: ctx.provider,
            operation: ctx.operation,
            message: "Quota exhausted",
            retryable: false,
            status: res.status,
          });
        }
        throw err;
      }

      let data: T;
      try {
        data = await ctx.parse(res);
      } catch (parseErr) {
        throw new ProviderError({
          code: "malformed_response",
          provider: ctx.provider,
          operation: ctx.operation,
          message: classifyThrown(parseErr).message,
          retryable: false,
          cause: parseErr,
        });
      }

      recordSuccess(ctx.provider, ctx.operation);
      noteProviderOutcome(ctx.provider, ctx.operation, null, quota);
      const durationMs = Date.now() - started;
      metrics.timing("provider_request_duration_ms", durationMs, {
        provider: ctx.provider,
        operation: ctx.operation,
      });
      if (quota.remaining != null) {
        metrics.gauge("provider_quota_remaining", quota.remaining, {
          provider: ctx.provider,
        });
      }
      return { data, attempts, durationMs, quota };
    } catch (err) {
      const classified =
        err instanceof ProviderError
          ? err
          : new ProviderError({
              ...classifyThrown(err),
              provider: ctx.provider,
              operation: ctx.operation,
              details: { timeoutMs: timeout.timeoutMs, attempt: attempts },
              cause: err,
            });

      lastError = classified;
      if (classified.code === "timeout") {
        metrics.increment("provider_timeout_total", {
          provider: ctx.provider,
          operation: ctx.operation,
        });
      }
      metrics.increment("provider_error_total", {
        provider: ctx.provider,
        code: classified.code,
      });

      const shouldRetry =
        classified.retryable &&
        attempts < retry.maxAttempts &&
        Date.now() < deadline &&
        classified.code !== "quota_exhausted" &&
        classified.code !== "authentication" &&
        classified.code !== "invalid_request" &&
        classified.code !== "malformed_response";

      if (!shouldRetry) {
        recordFailure(ctx.provider, ctx.operation);
        noteProviderOutcome(ctx.provider, ctx.operation, classified);
        throw classified;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  recordFailure(ctx.provider, ctx.operation);
  const finalError =
    lastError ??
    new ProviderError({
      code: "unavailable",
      provider: ctx.provider,
      operation: ctx.operation,
      message: "Provider call failed",
    });
  noteProviderOutcome(ctx.provider, ctx.operation, finalError);
  // Raw Provider Archive — body-less lineage for a terminal (network/timeout) failure. DORMANT
  // by default; fail-open. Response-bearing failures are already captured above.
  maybeCaptureRawFailure(
    { provider: ctx.provider, operation: ctx.operation, endpoint: ctx.endpoint },
    { attempts, errorCode: finalError.code, durationMs: Date.now() - started }
  );
  throw finalError;
}

/** Soft wrapper: returns null on failure (legacy callers). */
export async function executeProviderCallSoft<T>(
  ctx: Parameters<typeof executeProviderCall<T>>[0]
): Promise<T | null> {
  try {
    const result = await executeProviderCall(ctx);
    return result.data;
  } catch {
    return null;
  }
}
