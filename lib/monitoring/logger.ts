import { getMonitoring } from "./provider";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  message: string;
  ts: string;
  scope?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

const REDACT_KEY_RE =
  /(secret|password|passwd|token|authorization|cookie|api[_-]?key|admin[_-]?key)/i;

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEY_RE.test(key)) return "[REDACTED]";
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…`;
  }
  return value;
}

function redactMeta(
  meta?: LogEvent["meta"]
): LogEvent["meta"] | undefined {
  if (!meta) return undefined;
  const out: LogEvent["meta"] = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = redactValue(key, value) as string | number | boolean | null | undefined;
  }
  return out;
}

function serialize(event: LogEvent): string {
  return JSON.stringify({
    ...event,
    meta: event.meta ?? undefined,
  });
}

export function log(event: Omit<LogEvent, "ts"> & { ts?: string }): void {
  const payload: LogEvent = {
    ...event,
    meta: redactMeta(event.meta),
    ts: event.ts ?? new Date().toISOString(),
  };
  const line = serialize(payload);
  if (payload.level === "error") console.error(line);
  else if (payload.level === "warn") console.warn(line);
  else console.log(line);

  if (payload.level === "error") {
    try {
      getMonitoring().captureMessage(payload.message, "error", {
        scope: payload.scope ?? null,
        ...payload.meta,
      });
    } catch {
      // Monitoring adapter failure must never crash logging.
    }
  }
}

export function logInfo(message: string, meta?: LogEvent["meta"], scope?: string): void {
  log({ level: "info", message, meta, scope });
}

export function logWarn(message: string, meta?: LogEvent["meta"], scope?: string): void {
  log({ level: "warn", message, meta, scope });
}

export function logError(message: string, meta?: LogEvent["meta"], scope?: string): void {
  log({ level: "error", message, meta, scope });
}

export function reportError(
  error: unknown,
  scope: string,
  meta?: LogEvent["meta"]
): void {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  try {
    getMonitoring().captureException(error, { scope, ...meta });
  } catch {
    // Monitoring adapter failure must never crash the request path.
  }
  try {
    logError(message, {
      ...meta,
      name: error instanceof Error ? error.name : "Error",
      stack: error instanceof Error ? error.stack?.slice(0, 2000) ?? null : null,
    }, scope);
  } catch {
    // Logger failure must never crash the request path.
  }
}
