export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logError, logWarn } = await import("@/lib/monitoring/logger");
  const { assertRuntimeEnvOrThrow, validateRuntimeEnv } = await import(
    "@/lib/config/env"
  );

  // next build sets NODE_ENV=production; full fail-fast applies at server start, not compile.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  try {
    if (!isBuild) {
      assertRuntimeEnvOrThrow();
    }
    const validation = validateRuntimeEnv();
    for (const warning of validation.warnings) {
      logWarn("env_warning", { warning }, "config");
    }
    if (isBuild && !validation.ok) {
      logWarn(
        "env_invalid_at_build",
        { errors: validation.errors.join(" | ") },
        "config"
      );
    }
  } catch (err) {
    logError(
      err instanceof Error ? err.message : String(err),
      { fatal: true },
      "config"
    );
    // Fail fast in staging/production — do not serve with invalid public origin/secrets.
    throw err;
  }

  // Production reliability: SIGTERM/SIGINT → graceful exit (boring PM2 restart);
  // uncaughtException → log fatal + exit clean (never keep serving corrupt state);
  // unhandledRejection → log for alerting (not fatal). See lib/monitoring/shutdown.ts.
  const { installProcessSafetyHandlers } = await import(
    "@/lib/monitoring/shutdown"
  );
  installProcessSafetyHandlers();

  try {
    const { warnIfMultiInstanceMemoryLimiter } = await import(
      "@/lib/security/rateLimit"
    );
    warnIfMultiInstanceMemoryLimiter();
  } catch {
    // non-fatal
  }

  logWarn("instrumentation_registered", { runtime: "nodejs" }, "process");
}
