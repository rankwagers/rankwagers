/**
 * M10 Benchmark Framework — report writer (Stage 2E, Slice 1).
 *
 * Assembles a cell result into an artifact envelope and writes the JSON / CSV / summary families.
 * Framework-only: it serializes whatever a LATER slice measured; it runs no benchmark and reads
 * no runtime module. Artifacts contain no secrets and no entity ids.
 */

import type {
  BenchArtifact,
  BenchCellResult,
  BenchConfigPublic,
  MachineSpec,
  Stats,
} from "./types";
import { isStable, hasTailConfidence } from "./statistics";
import { writeJson, writeCsv, writeSummary } from "./fsutil";

/** Wrap a cell result in the versioned artifact envelope. */
export function buildArtifact(
  result: BenchCellResult,
  machine: MachineSpec,
  config: BenchConfigPublic,
  generatedAt: string
): BenchArtifact {
  return { schemaVersion: 1, generatedAt, machine, config, result };
}

function statsRow(label: string, s: Stats): (string | number)[] {
  return [
    label,
    s.n,
    round(s.min),
    round(s.median),
    round(s.p95),
    round(s.p99),
    round(s.max),
    round(s.mean),
    round(s.stddev),
    round(s.cv, 4),
  ];
}

function round(n: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const STATS_HEADER = ["metric", "n", "min", "p50", "p95", "p99", "max", "mean", "stddev", "cv"];

/** Render a compact markdown summary for one cell. */
export function renderSummary(
  artifact: BenchArtifact,
  cvThreshold: number,
  criticalSamples: number
): string {
  const { result, machine, config, generatedAt } = artifact;
  const total = result.stats.total;
  const stable = isStable(total, cvThreshold);
  const tail = hasTailConfidence(total, criticalSamples);
  const lines: string[] = [
    `# Benchmark cell: ${result.id}`,
    "",
    `${result.describe}`,
    "",
    `- generatedAt: ${generatedAt}`,
    `- machine: ${machine.cpuModel} ×${machine.cpuCount}, ${machine.osType} ${machine.osRelease}, node ${machine.nodeVersion}`,
    `- coords: ${JSON.stringify(result.coords ?? {})}`,
    `- command: ${result.command}`,
    `- seed: ${result.seed}`,
    `- samples: warm=${config.warmSamples} cold=${config.coldSamples} warmup=${config.warmup}`,
    `- stability (CV ≤ ${cvThreshold}): ${stable ? "OK" : "UNSTABLE"} (cv=${round(total.cv, 4)})`,
    `- tail confidence (n ≥ ${criticalSamples}): ${tail ? "OK" : "INSUFFICIENT"} (n=${total.n})`,
    result.budgetMs !== undefined
      ? `- budget: ${result.budgetMs} ms → ${result.passed ? "PASS" : "FAIL"} (p95=${round(total.p95)} ms)`
      : `- budget: (none)`,
    "",
    "| metric | n | min | p50 | p95 | p99 | max | mean | stddev | cv |",
    "|---|---|---|---|---|---|---|---|---|---|",
    `| total | ${total.n} | ${round(total.min)} | ${round(total.median)} | ${round(total.p95)} | ${round(total.p99)} | ${round(total.max)} | ${round(total.mean)} | ${round(total.stddev)} | ${round(total.cv, 4)} |`,
  ];
  if (result.stats.cold) lines.push(rowMd("cold", result.stats.cold));
  if (result.stats.warm) lines.push(rowMd("warm", result.stats.warm));
  for (const [phase, s] of Object.entries(result.stats.phases ?? {})) {
    lines.push(rowMd(`phase:${phase}`, s));
  }
  if (result.notes?.length) {
    lines.push("", "## notes", ...result.notes.map((n) => `- ${n}`));
  }
  return lines.join("\n");
}

function rowMd(label: string, s: Stats): string {
  return `| ${label} | ${s.n} | ${round(s.min)} | ${round(s.median)} | ${round(s.p95)} | ${round(s.p99)} | ${round(s.max)} | ${round(s.mean)} | ${round(s.stddev)} | ${round(s.cv, 4)} |`;
}

const RAW_HEADER = [
  "cell",
  "run_id",
  "class",
  "sample_index",
  "phase",
  "phase_status",
  "phase_ms",
  "skip_reason",
  "sample_total_ms",
  "success",
  "deadline_outcome",
];

/**
 * Raw per-sample, per-phase rows — percentiles in the summary are computed from THESE (finding
 * M-G), never from a runtime metrics aggregate. Each phase (incl. explicit skips with a reason)
 * is one row so no phase is fabricated as a zero-duration success.
 */
function rawSampleRows(cellId: string, artifact: BenchArtifact): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const s of artifact.result.samples) {
    const records = s.phaseRecords ?? [];
    if (records.length === 0) {
      rows.push([cellId, s.runId ?? "", s.kind, s.index, "(total)", "ran", round(s.durationMs), "", round(s.durationMs), String(s.success ?? ""), s.deadlineOutcome ?? ""]);
      continue;
    }
    for (const r of records) {
      rows.push([
        cellId,
        s.runId ?? "",
        s.kind,
        s.index,
        r.name,
        r.status,
        round(r.durationMs),
        r.skipReason ?? "",
        round(s.durationMs),
        String(s.success ?? ""),
        s.deadlineOutcome ?? "",
      ]);
    }
  }
  return rows;
}

/** Write all artifact families for one cell (incl. the raw per-sample CSV); returns the paths. */
export async function writeArtifacts(
  outputDir: string,
  artifact: BenchArtifact,
  cvThreshold: number,
  criticalSamples: number
): Promise<{ json: string; csv: string; rawCsv: string; summary: string }> {
  const base = safeBasename(artifact.result.id);
  const jsonPath = await writeJson(outputDir, `${base}.json`, artifact);

  // CSV #1: per-metric stats.
  const rows: (string | number)[][] = [statsRow("total", artifact.result.stats.total)];
  if (artifact.result.stats.cold) rows.push(statsRow("cold", artifact.result.stats.cold));
  if (artifact.result.stats.warm) rows.push(statsRow("warm", artifact.result.stats.warm));
  for (const [phase, s] of Object.entries(artifact.result.stats.phases ?? {})) {
    rows.push(statsRow(`phase:${phase}`, s));
  }
  const csvPath = await writeCsv(outputDir, `${base}.stats.csv`, STATS_HEADER, rows);

  // CSV #2: raw per-sample, per-phase evidence (the percentile source of truth).
  const rawCsvPath = await writeCsv(
    outputDir,
    `${base}.raw.csv`,
    RAW_HEADER,
    rawSampleRows(artifact.result.id, artifact)
  );

  const summaryPath = await writeSummary(
    outputDir,
    `${base}.md`,
    renderSummary(artifact, cvThreshold, criticalSamples)
  );

  return { json: jsonPath, csv: csvPath, rawCsv: rawCsvPath, summary: summaryPath };
}

/** Bound a cell id to a filesystem-safe basename. */
export function safeBasename(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "cell";
}
