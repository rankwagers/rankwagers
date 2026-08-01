/**
 * Fetch orchestration contract (Sprint 23B, M4).
 *
 * Coordinates a deterministic fetch plan against an INJECTABLE `SourceFetcher`
 * (real provider clients are wired later at M6; M4 uses test doubles / pure logic —
 * no real network here). Enforces the M0 upstream config: concurrency cap
 * (min(global, footystats)), `retryLimit`, `runDeadlineMs`, `requestBudget`,
 * `maxFailureRatio`. Returns a categorized result; it NEVER fabricates data, never
 * converts a provider failure into empty success, and never silently falls back.
 *
 * DETERMINISM: for the same `(plan, fetcher, config, clock)` the categorized result is
 * identical regardless of async scheduling. Fetches run in rounds (one attempt each
 * per round, up to `retryLimit` rounds); within a round, sources are gated in plan
 * order, `requestBudget` (attempts) is consumed in `(round, plan-order)`, and the next
 * round's retry set is re-derived by a plan-order filter — not by completion order.
 * `Date.now`/random/pid/hostname/mutable-global-state are never used; the deadline
 * clock is injected.
 */

import type { EvidenceUpstreamConfig } from "../config";
import type { JsonValue } from "../provider-archive";
import type { PlannedFetch, SourceKind } from "./sources";

export type FetchResult =
  | { status: "ok"; payload: JsonValue; retrievedAt: string }
  | { status: "timeout" }
  | { status: "failed"; reason: string }
  | { status: "unavailable" };

export type SourceFetcher = (source: PlannedFetch) => Promise<FetchResult>;

export type SourceFetchStatus =
  | "ok"
  | "failed"
  | "timeout"
  | "unavailable"
  | "skipped_fresh"
  | "skipped_budget"
  | "skipped_deadline";

export type SourceFetchResult = {
  sourceKey: string;
  kind: SourceKind;
  status: SourceFetchStatus;
  attempts: number;
  payload?: JsonValue;
  retrievedAt?: string;
  reason?: string;
};

export type FetchRunResult = {
  status: "ok" | "failed";
  reason: "failure_ratio_exceeded" | null;
  results: SourceFetchResult[];
  counts: {
    total: number;
    ok: number;
    failed: number;
    skipped: number;
    attempts: number;
  };
};

const RETRYABLE = new Set(["timeout", "failed"]);
const FAILURE_STATUSES = new Set(["failed", "timeout", "unavailable"]);

type Slot = {
  fetch: PlannedFetch;
  status: SourceFetchStatus | "pending" | "retry";
  attempts: number;
  payload?: JsonValue;
  retrievedAt?: string;
  reason?: string;
};

/** Injected monotonic clock in ms — NEVER `Date.now` inside M4. */
export type Clock = () => number;

export async function orchestrateFetches(
  plan: { fetches: readonly PlannedFetch[] },
  fetcher: SourceFetcher,
  config: EvidenceUpstreamConfig,
  clock: Clock
): Promise<FetchRunResult> {
  const cap = Math.max(
    1,
    Math.min(config.globalConcurrency, config.footystatsConcurrency)
  );
  const start = clock();
  let budget = config.requestBudget; // null (no ceiling) or positive int
  let attemptsUsed = 0;

  const slots = new Map<string, Slot>();
  let queue: string[] = []; // sourceKeys pending a fetch, in plan order
  for (const pf of plan.fetches) {
    if (pf.action === "skip_fresh") {
      slots.set(pf.sourceKey, { fetch: pf, status: "skipped_fresh", attempts: 0 });
    } else {
      slots.set(pf.sourceKey, { fetch: pf, status: "pending", attempts: 0 });
      queue.push(pf.sourceKey);
    }
  }

  const deadlineExceeded = () =>
    config.runDeadlineMs > 0 && clock() - start > config.runDeadlineMs;

  for (let round = 1; round <= config.retryLimit && queue.length > 0; round++) {
    const inFlight = new Set<Promise<void>>();
    for (const sourceKey of queue) {
      const slot = slots.get(sourceKey) as Slot;
      if (deadlineExceeded()) {
        slot.status = "skipped_deadline";
        continue;
      }
      if (budget !== null && budget <= 0) {
        slot.status = "skipped_budget";
        continue;
      }
      if (budget !== null) budget -= 1;
      attemptsUsed += 1;
      slot.attempts = round;
      const run = fetcher(slot.fetch)
        .then((outcome) => {
          if (outcome.status === "ok") {
            slot.status = "ok";
            slot.payload = outcome.payload;
            slot.retrievedAt = outcome.retrievedAt;
          } else if (outcome.status === "unavailable") {
            slot.status = "unavailable";
          } else if (RETRYABLE.has(outcome.status)) {
            if (outcome.status === "failed") slot.reason = outcome.reason;
            slot.status = round < config.retryLimit ? "retry" : outcome.status;
          }
        })
        .finally(() => {
          inFlight.delete(run);
        });
      inFlight.add(run);
      if (inFlight.size >= cap) await Promise.race(inFlight);
    }
    await Promise.all(inFlight);
    // Next round's retry set, re-derived in plan order (never completion order).
    const nextQueue = queue.filter((sk) => slots.get(sk)?.status === "retry");
    for (const sk of nextQueue) (slots.get(sk) as Slot).status = "pending";
    queue = nextQueue;
  }

  // Assemble results in plan order.
  const results: SourceFetchResult[] = plan.fetches.map((pf) => {
    const slot = slots.get(pf.sourceKey) as Slot;
    const status = (slot.status === "pending" || slot.status === "retry"
      ? "failed"
      : slot.status) as SourceFetchStatus;
    return {
      sourceKey: pf.sourceKey,
      kind: pf.kind,
      status,
      attempts: slot.attempts,
      ...(slot.payload !== undefined ? { payload: slot.payload } : {}),
      ...(slot.retrievedAt !== undefined ? { retrievedAt: slot.retrievedAt } : {}),
      ...(slot.reason !== undefined ? { reason: slot.reason } : {}),
    };
  });

  const attempted = results.filter(
    (r) => r.status !== "skipped_fresh" && r.status !== "skipped_budget" && r.status !== "skipped_deadline"
  );
  const failed = attempted.filter((r) => FAILURE_STATUSES.has(r.status)).length;
  const ratio = attempted.length === 0 ? 0 : failed / attempted.length;
  const ratioExceeded = ratio > config.maxFailureRatio;

  return {
    status: ratioExceeded ? "failed" : "ok",
    reason: ratioExceeded ? "failure_ratio_exceeded" : null,
    results,
    counts: {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      failed,
      skipped: results.filter((r) => r.status.startsWith("skipped_")).length,
      attempts: attemptsUsed,
    },
  };
}
