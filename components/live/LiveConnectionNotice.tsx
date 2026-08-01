"use client";

import { useLiveConnection } from "@/lib/live/context";

/**
 * Sprint 22 — poll state surface.
 *
 * The only consumer of `LiveConnectionContext`, which is what keeps per-tick poll state from
 * invalidating the slice subscribers. Renders nothing while polling is healthy: a permanent
 * "connected" badge is noise, whereas a stalled feed is information the user needs.
 */

export function LiveConnectionNotice() {
  const connection = useLiveConnection();
  if (!connection) return null;

  if (connection.connection === "error") {
    return (
      <div
        className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-xs text-[var(--amber-primary)]"
        role="status"
        data-testid="live-connection-error"
      >
        <span>
          Live updates stopped after {connection.consecutiveFailures} failed attempts. The
          figures shown are the last values received.
        </span>
        <button
          type="button"
          onClick={connection.retry}
          className="min-h-[var(--touch-min)] rounded-md border border-current px-3 py-1 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Retry live updates
        </button>
      </div>
    );
  }

  if (connection.connection === "stopped") {
    return (
      <p className="text-xs text-muted-foreground" data-testid="live-connection-stopped">
        Live updates have ended for this fixture.
      </p>
    );
  }

  return null;
}
