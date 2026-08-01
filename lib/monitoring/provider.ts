/**
 * Monitoring abstraction.
 * Console today → Sentry (or other) later without changing call sites.
 */

export type MonitoringLevel = "debug" | "info" | "warning" | "error";

export type MonitoringContext = Record<
  string,
  string | number | boolean | null | undefined
>;

export type MonitoringProvider = {
  readonly name: string;
  captureException(error: unknown, context?: MonitoringContext): void;
  captureMessage(
    message: string,
    level?: MonitoringLevel,
    context?: MonitoringContext
  ): void;
};

function serializeError(error: unknown): MonitoringContext {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.slice(0, 2000) ?? null,
    };
  }
  return { message: typeof error === "string" ? error : "Unknown error" };
}

export const consoleMonitoringProvider: MonitoringProvider = {
  name: "console",
  captureException(error, context) {
    console.error(
      JSON.stringify({
        type: "exception",
        provider: "console",
        ts: new Date().toISOString(),
        ...serializeError(error),
        ...context,
      })
    );
  },
  captureMessage(message, level = "info", context) {
    const line = JSON.stringify({
      type: "message",
      provider: "console",
      level,
      message,
      ts: new Date().toISOString(),
      ...context,
    });
    if (level === "error") console.error(line);
    else if (level === "warning") console.warn(line);
    else console.log(line);
  },
};

let provider: MonitoringProvider = consoleMonitoringProvider;

export function getMonitoring(): MonitoringProvider {
  return provider;
}

export function setMonitoringProvider(next: MonitoringProvider): void {
  provider = next;
}

export function resetMonitoringProvider(): void {
  provider = consoleMonitoringProvider;
}
