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
        className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px]"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          borderRadius: 6,
          color: "var(--muted)",
        }}
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
          className="rw3-ghost min-h-[var(--touch-min)]"
        >
          Retry live updates
        </button>
      </div>
    );
  }

  if (connection.connection === "stopped") {
    return (
      <p className="rw3-meta" data-testid="live-connection-stopped">
        Live updates have ended for this fixture.
      </p>
    );
  }

  return null;
}
