/**
 * M10 Benchmark Framework — measurement phases (Stage 2E, Slice 2).
 *
 * Canonical, non-overlapping timing phases for the live-candidate route. Phases are measured
 * SEQUENTIALLY (each `ran()` wraps exactly one unit of work), so they cannot overlap. A phase
 * that does not execute is recorded EXPLICITLY as `skipped` with a reason — never fabricated as
 * a zero-duration success. Route entry is the caller-owned monotonic anchor (finding F-C).
 */

import { time } from "./timing";
import type { PhaseRecord } from "./types";

/** The canonical phase set (order = route-entry → total). */
export const PHASES = [
  "route_entry_to_runner",
  "source_load",
  "archive_load",
  "discovery",
  "candidate_prepare",
  "settlement",
  "capture",
  "writer",
  "cleanup",
  "total",
  // Derived comparison phases (Slice 2): the runner-entry escaped budget + its total.
  "deadline_gap",
  "total_from_runner_entry",
] as const;
export type PhaseName = (typeof PHASES)[number];

/**
 * Records non-overlapping phase durations for one run. `ran()` times a unit of work; `skip()`
 * records an explicit skip. `total` is measured separately from the route-entry anchor.
 */
export class PhaseRecorder {
  private readonly records: PhaseRecord[] = [];

  /** Measure one phase's work sequentially and record its duration. */
  async ran<T>(name: PhaseName, fn: () => Promise<T> | T): Promise<T> {
    const { result, durationMs } = await time(fn);
    this.records.push({ name, status: "ran", durationMs });
    return result;
  }

  /** Record a synchronous phase's duration without a value. */
  ranSync(name: PhaseName, durationMs: number): void {
    this.records.push({ name, status: "ran", durationMs: Math.max(0, durationMs) });
  }

  /** Explicitly record a phase that did not execute. */
  skip(name: PhaseName, reason: string): void {
    this.records.push({ name, status: "skipped", durationMs: 0, skipReason: reason });
  }

  /** The recorded phases in order. */
  finish(): PhaseRecord[] {
    return [...this.records];
  }
}

/** RAN-phase durations map for the statistics layer (skipped phases excluded). */
export function ranPhaseDurations(records: readonly PhaseRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) {
    if (r.status === "ran") out[r.name] = r.durationMs;
  }
  return out;
}

/** Sum of RAN phase durations (excludes the synthetic `total` phase to avoid double counting). */
export function summedRanMs(records: readonly PhaseRecord[]): number {
  return records
    .filter((r) => r.status === "ran" && r.name !== "total")
    .reduce((acc, r) => acc + r.durationMs, 0);
}
