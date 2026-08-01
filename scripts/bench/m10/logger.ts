/**
 * M10 Benchmark Framework — logging abstraction (Stage 2E, Slice 1).
 *
 * Bounded structured logging to stdout + an optional log-file sink under `logs/`. Best-effort:
 * a logging failure never throws out of a benchmark. No secrets, no entity ids, no runtime
 * coupling. Uses an injectable clock so timestamps are testable/deterministic if needed.
 */

import { appendLog } from "./fsutil";

export type BenchLogLevel = "info" | "warn" | "error";

export type BenchLoggerOptions = {
  /** When set, lines are also appended to `<outputDir>/logs/<logFile>`. */
  outputDir?: string;
  logFile?: string;
  /** Cap on in-memory retained lines (bounded). */
  maxRetained?: number;
  /** Injectable ISO timestamp source. */
  nowIso?: () => string;
  /** Suppress stdout (e.g. for tests). */
  silent?: boolean;
};

export class BenchLogger {
  private readonly lines: string[] = [];
  private readonly maxRetained: number;
  private readonly nowIso: () => string;

  constructor(private readonly opts: BenchLoggerOptions = {}) {
    this.maxRetained = opts.maxRetained ?? 1000;
    this.nowIso = opts.nowIso ?? (() => new Date().toISOString());
  }

  private format(level: BenchLogLevel, msg: string, fields?: Record<string, unknown>): string {
    const base = `${this.nowIso()} [${level}] ${msg}`;
    return fields && Object.keys(fields).length ? `${base} ${JSON.stringify(fields)}` : base;
  }

  private emit(level: BenchLogLevel, msg: string, fields?: Record<string, unknown>): void {
    const line = this.format(level, msg, fields);
    this.lines.push(line);
    if (this.lines.length > this.maxRetained) {
      this.lines.splice(0, this.lines.length - this.maxRetained);
    }
    if (!this.opts.silent) {
      const sink = level === "error" ? process.stderr : process.stdout;
      sink.write(line + "\n");
    }
    if (this.opts.outputDir && this.opts.logFile) {
      // Best-effort file sink; never throw out of logging.
      void appendLog(this.opts.outputDir, this.opts.logFile, line).catch(() => undefined);
    }
  }

  info(msg: string, fields?: Record<string, unknown>): void {
    this.emit("info", msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.emit("warn", msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.emit("error", msg, fields);
  }

  /** A copy of the retained lines (bounded). */
  retained(): string[] {
    return [...this.lines];
  }
}
