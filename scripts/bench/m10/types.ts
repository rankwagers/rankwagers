/**
 * M10 Benchmark Framework — shared types (Stage 2E, Slice 1).
 *
 * Framework-only. No runtime coupling; Node built-ins only elsewhere in this directory.
 */

/** A single measured sample — a raw wall-duration plus optional phase/resource detail. */
export type SampleKind = "cold" | "warm" | "warmup";

export type MemorySnapshotMB = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
};

export type EventLoopDelayMs = {
  min: number;
  mean: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
};

/** Whether a run's deadline budget would have been respected (Slice 2). */
export type DeadlineOutcome = "ok" | "deferred" | "exceeded" | "n/a";

/** One explicitly-represented phase within a run: it RAN (with a duration) or was SKIPPED. */
export type PhaseRecord = {
  name: string;
  status: "ran" | "skipped";
  /** Wall duration (ms) for a `ran` phase; 0 for a `skipped` phase. */
  durationMs: number;
  /** Present only when `status === "skipped"` — never fabricated zero-duration success. */
  skipReason?: string;
};

export type Sample = {
  /** 0-based index within its kind. */
  index: number;
  kind: SampleKind;
  /** Total wall duration for this sample, in milliseconds. */
  durationMs: number;
  /** Stable per-run identifier (never an entity id). */
  runId?: string;
  /** Whether the measured run succeeded. */
  success?: boolean;
  /** Deadline outcome for this run (Slice 2 deadline evidence). */
  deadlineOutcome?: DeadlineOutcome;
  /** Explicit per-phase records (ran/skipped) — the source of truth for phase reporting. */
  phaseRecords?: PhaseRecord[];
  /** Optional per-phase wall durations (ms) for RAN phases only (derived from `phaseRecords`). */
  phasesMs?: Record<string, number>;
  /** Optional memory snapshot captured for this sample. */
  memoryMB?: MemorySnapshotMB;
  /** Optional event-loop delay histogram for this sample. */
  eventLoopDelayMs?: EventLoopDelayMs;
  /** Optional hardware-independent per-op counts (archive reads, bytes parsed, files opened…). */
  counts?: Record<string, number>;
};

/** Descriptive statistics computed from RAW samples (never the runtime metrics aggregate). */
export type Stats = {
  n: number;
  min: number;
  max: number;
  mean: number;
  /** p50. */
  median: number;
  p95: number;
  p99: number;
  stddev: number;
  /** Coefficient of variation = stddev / mean; NaN-safe (0 when mean is 0). */
  cv: number;
};

/** Machine / runtime specification for reproducibility. */
export type MachineSpec = {
  capturedAt: string;
  nodeVersion: string;
  v8Version: string;
  platform: string;
  arch: string;
  osType: string;
  osRelease: string;
  cpuModel: string;
  cpuCount: number;
  totalMemMB: number;
  hostnameHash: string; // one-way hash — never a raw hostname in an artifact
};

/** One benchmark cell's matrix coordinates (depth × source × volume × mode × concurrency). */
export type BenchCellCoords = {
  depth?: string;
  source?: string;
  volume?: number | string;
  mode?: string;
  concurrency?: string;
  [dimension: string]: string | number | undefined;
};

/** A registered benchmark cell (its `run` is provided by a LATER slice — none here). */
export type BenchCell = {
  id: string;
  describe: string;
  coords?: BenchCellCoords;
  /** Executed by a later slice; absent in Slice 1. */
  run?: (ctx: BenchContext) => Promise<void> | void;
};

/** The result of one cell after sampling (assembled by later slices). */
export type BenchCellResult = {
  id: string;
  describe: string;
  coords?: BenchCellCoords;
  command: string;
  seed: number;
  samples: Sample[];
  stats: {
    total: Stats;
    cold?: Stats;
    warm?: Stats;
    phases?: Record<string, Stats>;
  };
  /** Pass/fail against a budget, when a budget is supplied. */
  budgetMs?: number;
  passed?: boolean;
  notes?: string[];
};

/** A completed artifact envelope written to disk. */
export type BenchArtifact = {
  schemaVersion: 1;
  generatedAt: string;
  machine: MachineSpec;
  config: BenchConfigPublic;
  result: BenchCellResult;
};

/** Config surface safe to embed in an artifact (no secrets, no absolute prod paths). */
export type BenchConfigPublic = {
  warmup: number;
  warmSamples: number;
  coldSamples: number;
  criticalSamples: number;
  cvUnstableThreshold: number;
  outputDirLabel: string;
};

/** Execution context handed to a cell's `run` by a later slice. */
export type BenchContext = {
  config: import("./config").BenchConfig;
  logger: import("./logger").BenchLogger;
};
