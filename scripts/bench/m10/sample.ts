/**
 * M10 Benchmark Framework — sample abstraction (Stage 2E, Slice 1).
 *
 * Collects RAW per-sample measurements, tagged cold / warm / warmup. Warmup samples are kept
 * separately and excluded from statistics (measurement contract: discard first W). Warm =
 * steady-state; cold = fresh-process worst case; the two are analysed separately (finding M-H).
 */

import type { Sample, SampleKind } from "./types";

export class SampleCollector {
  private readonly samples: Sample[] = [];
  private readonly counters: Record<SampleKind, number> = {
    warmup: 0,
    cold: 0,
    warm: 0,
  };

  /** Record one measured sample under the given kind; assigns its per-kind index. */
  add(kind: SampleKind, sample: Omit<Sample, "index" | "kind">): Sample {
    const index = this.counters[kind]++;
    const full: Sample = { index, kind, ...sample };
    this.samples.push(full);
    return full;
  }

  /** All samples (including warmup), in collection order. */
  all(): readonly Sample[] {
    return this.samples;
  }

  /** Samples of one kind. */
  ofKind(kind: SampleKind): Sample[] {
    return this.samples.filter((s) => s.kind === kind);
  }

  /** Raw total-duration values for a kind (warmup excluded from analysis by callers). */
  durations(kind: SampleKind): number[] {
    return this.ofKind(kind).map((s) => s.durationMs);
  }

  /** Warm + cold total durations combined (analysis set; warmup excluded). */
  analysisDurations(): number[] {
    return this.samples
      .filter((s) => s.kind !== "warmup")
      .map((s) => s.durationMs);
  }

  /** Per-phase raw durations across the analysis set, keyed by phase name. */
  phaseDurations(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const s of this.samples) {
      if (s.kind === "warmup" || !s.phasesMs) continue;
      for (const [phase, ms] of Object.entries(s.phasesMs)) {
        (out[phase] ??= []).push(ms);
      }
    }
    return out;
  }

  count(kind: SampleKind): number {
    return this.counters[kind];
  }
}
