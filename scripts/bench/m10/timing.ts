/**
 * M10 Benchmark Framework — timing abstraction (Stage 2E, Slice 1).
 *
 * Wall-clock timing via `process.hrtime.bigint()` (monotonic, high-resolution) plus a phase
 * timer and memory / event-loop-delay snapshots. Framework-only: it measures whatever a LATER
 * slice hands it; it performs NO route timing and touches NO runtime module here.
 */

import { monitorEventLoopDelay } from "node:perf_hooks";
import type { EventLoopDelayMs, MemorySnapshotMB } from "./types";

const NS_PER_MS = 1_000_000;

/** Monotonic high-resolution now, in milliseconds (float). */
export function nowMs(): number {
  return Number(process.hrtime.bigint()) / NS_PER_MS;
}

/** Time a synchronous or async function; returns its result plus the wall duration (ms). */
export async function time<T>(fn: () => Promise<T> | T): Promise<{ result: T; durationMs: number }> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const durationMs = Number(process.hrtime.bigint() - start) / NS_PER_MS;
  return { result, durationMs };
}

/**
 * A phase timer for splitting one run into named phases (e.g. source / archive / discovery /
 * batch / cleanup). `mark(phase)` records the ms elapsed since the previous mark (or `start()`).
 */
export class PhaseTimer {
  private lastNs: bigint;
  private readonly startNs: bigint;
  private readonly phases: Record<string, number> = {};

  constructor() {
    this.startNs = process.hrtime.bigint();
    this.lastNs = this.startNs;
  }

  /** Record elapsed since the previous mark under `phase` and advance the cursor. */
  mark(phase: string): void {
    const now = process.hrtime.bigint();
    this.phases[phase] = Number(now - this.lastNs) / NS_PER_MS;
    this.lastNs = now;
  }

  /** Total elapsed since construction, in ms. */
  totalMs(): number {
    return Number(process.hrtime.bigint() - this.startNs) / NS_PER_MS;
  }

  /** A copy of the recorded phase durations (ms). */
  durations(): Record<string, number> {
    return { ...this.phases };
  }
}

/** Current process memory usage, mapped to megabytes. */
export function memorySnapshotMB(): MemorySnapshotMB {
  const m = process.memoryUsage();
  const toMB = (b: number) => Math.round((b / 1024 / 1024) * 1000) / 1000;
  return {
    rss: toMB(m.rss),
    heapUsed: toMB(m.heapUsed),
    heapTotal: toMB(m.heapTotal),
    external: toMB(m.external),
    arrayBuffers: toMB(m.arrayBuffers),
  };
}

/** A start/stop event-loop-delay monitor producing a percentile histogram in ms. */
export function createEventLoopMonitor(resolutionMs = 10) {
  const histogram = monitorEventLoopDelay({ resolution: resolutionMs });
  return {
    start(): void {
      histogram.enable();
    },
    /** Stop and return the delay histogram (ms). */
    stop(): EventLoopDelayMs {
      histogram.disable();
      const toMs = (ns: number) => (Number.isFinite(ns) ? ns / NS_PER_MS : 0);
      return {
        min: toMs(histogram.min),
        mean: toMs(histogram.mean),
        max: toMs(histogram.max),
        p50: toMs(histogram.percentile(50)),
        p95: toMs(histogram.percentile(95)),
        p99: toMs(histogram.percentile(99)),
      };
    },
    reset(): void {
      histogram.reset();
    },
  };
}
