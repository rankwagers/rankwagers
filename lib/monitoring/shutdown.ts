/**
 * Process safety & graceful shutdown handlers (production reliability hardening).
 *
 * Installed exactly once at server start (from `instrumentation.ts`). Intent:
 *
 *  - **SIGTERM / SIGINT** → graceful: log the intent and exit 0 so PM2 performs a *boring*
 *    restart. In-flight work is given a bounded grace window (< PM2 `kill_timeout`) to drain;
 *    if the event loop empties naturally the process exits sooner (the grace timer is `unref`ed).
 *  - **uncaughtException** → the process is now in an UNDEFINED state. Log fatal and exit
 *    non-zero so PM2 recycles a *clean* process. This is the documented Node practice — never
 *    keep serving after an uncaught exception (it silently corrupts state and leaks handlers).
 *  - **unhandledRejection** → log (warn) for alerting, but do NOT exit on a single stray
 *    rejection (that would let one bad promise flap the whole server). Surfaced, not fatal.
 *
 * Idempotent (handlers install once; shutdown runs once). No throw escapes any handler.
 * The injected clock/timer is `unref`ed so this module can never, by itself, keep the process
 * alive or delay a natural exit.
 */

import { logError, logInfo, logWarn } from "@/lib/monitoring/logger";

/**
 * PM2 `kill_timeout` in `deploy/ecosystem.config.cjs` (aff-site). Keep these two in sync.
 *
 * 60s, above the 45s capture deadline (`EFFECTIVE_DEADLINE_HARD_MAX_MS`). The evidence archive
 * is append-only and permanent: a SIGKILL landing mid-`appendFile` can leave a torn line in it
 * forever. The window must therefore outlast the longest run that writes, not the shortest that
 * serves — a restart during capture now waits for the append instead of severing it.
 */
export const PM2_KILL_TIMEOUT_MS = 60_000;
/** Safe margin so the graceful drain always finishes before PM2 escalates to SIGKILL. */
export const SIGNAL_GRACE_SAFETY_MARGIN_MS = 1_000;
/** Hard ceiling for the drain window: strictly below `kill_timeout` by the safety margin. */
export const MAX_SIGNAL_GRACE_MS = PM2_KILL_TIMEOUT_MS - SIGNAL_GRACE_SAFETY_MARGIN_MS;
/**
 * Default drain window when `SHUTDOWN_GRACE_MS` is unset/invalid.
 *
 * 50s — deliberately above the 45s capture deadline and below the 59s clamp. Raising PM2's
 * `kill_timeout` alone would NOT protect an in-flight append: the process exits itself once this
 * window elapses, so an 8s drain would still cut a 45s capture short well before PM2 escalated.
 * Both numbers have to clear the deadline for the guarantee to hold.
 */
export const DEFAULT_SIGNAL_GRACE_MS = 50_000;

/**
 * Resolve the graceful-shutdown drain window (AD-1).
 *
 * `SHUTDOWN_GRACE_MS` may raise the window, but it is ALWAYS clamped strictly below the PM2
 * `kill_timeout` (by {@link SIGNAL_GRACE_SAFETY_MARGIN_MS}). Without this clamp, an operator
 * setting `SHUTDOWN_GRACE_MS > kill_timeout` would make PM2 SIGKILL mid-drain, defeating the
 * graceful shutdown. Invalid / non-positive values fall back to {@link DEFAULT_SIGNAL_GRACE_MS}.
 */
export function resolveSignalGraceMs(
  env: NodeJS.ProcessEnv = process.env,
  killTimeoutMs: number = PM2_KILL_TIMEOUT_MS
): number {
  const cap = Math.max(0, killTimeoutMs - SIGNAL_GRACE_SAFETY_MARGIN_MS);
  const raw = Number(env.SHUTDOWN_GRACE_MS);
  const requested = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SIGNAL_GRACE_MS;
  return Math.min(requested, cap);
}

/**
 * Full drain window for a controlled signal. Kept strictly below the PM2 `kill_timeout`
 * (60 000 ms) so we always exit before PM2 escalates to SIGKILL — enforced by a hard clamp.
 */
const SIGNAL_GRACE_MS = resolveSignalGraceMs();
/** After an uncaught exception the state is corrupt — flush logs briefly, then exit fast. */
const FATAL_GRACE_MS = Math.min(SIGNAL_GRACE_MS, 1000);

let installed = false;
let shuttingDown = false;

/** Exit once, after a bounded grace window. Never throws; the timer never blocks a natural exit. */
function shutdown(reason: string, code: number, graceMs: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    (code === 0 ? logInfo : logError)(
      "process_shutdown",
      { reason, code, graceMs },
      "process"
    );
  } catch {
    // logging must never block or fail a shutdown
  }
  const timer = setTimeout(() => {
    process.exit(code);
  }, graceMs);
  if (typeof timer.unref === "function") timer.unref();
}

/** Install the SIGTERM/SIGINT/uncaughtException/unhandledRejection handlers once. */
export function installProcessSafetyHandlers(): void {
  if (installed) return;
  installed = true;

  process.on("SIGTERM", () => shutdown("SIGTERM", 0, SIGNAL_GRACE_MS));
  process.on("SIGINT", () => shutdown("SIGINT", 0, SIGNAL_GRACE_MS));

  process.on("uncaughtException", (error: Error) => {
    try {
      logError(
        "uncaught_exception",
        { name: error?.name, message: error?.message, fatal: true },
        "process"
      );
    } catch {
      // ignore
    }
    // Undefined state → restart clean. Exit non-zero so PM2 (min_uptime + exp_backoff)
    // recycles the process instead of serving corrupted state.
    shutdown("uncaughtException", 1, FATAL_GRACE_MS);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    try {
      logWarn(
        "unhandled_rejection",
        { reason: reason instanceof Error ? reason.message : String(reason) },
        "process"
      );
    } catch {
      // ignore
    }
    // Deliberately NOT fatal: one stray rejection must not flap the server. Alerting keys
    // off the emitted `unhandled_rejection` log/metric, not a process exit.
  });
}
