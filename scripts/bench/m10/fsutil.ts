/**
 * M10 Benchmark Framework — filesystem abstraction (Stage 2E, Slice 1).
 *
 * Atomic artifact writes (temp + rename) into the four artifact families (json / csv / summary /
 * logs). Framework-only: it writes ONLY under the benchmark output dir; it never touches the
 * evidence archive, the live source dir, or any production path.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type ArtifactFamily = "json" | "csv" | "summary" | "logs";

/** Absolute path for an artifact of the given family + basename under the output root. */
export function artifactPath(
  outputDir: string,
  family: ArtifactFamily,
  basename: string
): string {
  return path.join(outputDir, family, basename);
}

/** Ensure a directory (and parents) exist. */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Ensure the four artifact-family subdirectories exist under the output root. */
export async function ensureArtifactDirs(outputDir: string): Promise<void> {
  await Promise.all(
    (["json", "csv", "summary", "logs"] as ArtifactFamily[]).map((f) =>
      ensureDir(path.join(outputDir, f))
    )
  );
}

/** Atomic write: write to `<file>.tmp` then rename over `<file>`. Never a torn artifact. */
export async function atomicWrite(file: string, contents: string): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, file);
}

/** Write a pretty-printed JSON artifact atomically. Returns the path written. */
export async function writeJson(
  outputDir: string,
  basename: string,
  value: unknown
): Promise<string> {
  const file = artifactPath(outputDir, "json", basename);
  await atomicWrite(file, JSON.stringify(value, null, 2) + "\n");
  return file;
}

const CSV_UNSAFE = /[",\n\r]/;

function csvCell(value: string | number): string {
  const s = String(value);
  return CSV_UNSAFE.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Write a CSV artifact (header + rows) atomically. Returns the path written. */
export async function writeCsv(
  outputDir: string,
  basename: string,
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[]
): Promise<string> {
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ];
  const file = artifactPath(outputDir, "csv", basename);
  await atomicWrite(file, lines.join("\n") + "\n");
  return file;
}

/** Write a markdown/plaintext summary artifact atomically. Returns the path written. */
export async function writeSummary(
  outputDir: string,
  basename: string,
  contents: string
): Promise<string> {
  const file = artifactPath(outputDir, "summary", basename);
  await atomicWrite(file, contents.endsWith("\n") ? contents : contents + "\n");
  return file;
}

/** Append a line to a log file under `logs/` (created on first write). */
export async function appendLog(
  outputDir: string,
  basename: string,
  line: string
): Promise<void> {
  const file = artifactPath(outputDir, "logs", basename);
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, line.endsWith("\n") ? line : line + "\n", "utf8");
}
