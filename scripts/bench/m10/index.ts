/**
 * M10 Benchmark Framework — barrel (Stage 2E, Slice 1).
 *
 * Framework-only. Importing this pulls in NO runtime/pipeline module — Node built-ins only.
 */

export * from "./types";
export * from "./config";
export * from "./statistics";
export * from "./timing";
export * from "./sample";
export * from "./machine";
export * from "./guards";
export * from "./fsutil";
export * from "./logger";
export * from "./report";
export { BenchRunner } from "./runner";
export type { SampleCellOptions } from "./runner";
