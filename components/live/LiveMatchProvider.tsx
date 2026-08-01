"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LiveConnectionContext,
  LiveStoreContext,
  type LiveConnectionState,
} from "@/lib/live/context";
import {
  LIVE_POLL_INTERVAL_MS,
  LIVE_POLL_MAX_FAILURES,
  LIVE_POLL_MAX_INTERVAL_MS,
  liveMatchApiPath,
} from "@/lib/live/paths";
import { createLiveStore } from "@/lib/live/store";
import type { LiveMatchSnapshot } from "@/types/live";

/**
 * Sprint 22 — the hydration island.
 *
 * This is the *only* component in the live layer that talks to the network. Everything it
 * wraps is either static server markup or a slice subscriber, so a poll that changes nothing
 * costs one fetch and zero renders.
 *
 * Behavioural rules:
 *  - polling stops as soon as the fixture leaves an in-play phase — a finished match must not
 *    keep a tab requesting forever;
 *  - polling pauses while the document is hidden and resumes (with an immediate check) on
 *    return, so a backgrounded tab is not billed for updates nobody is reading;
 *  - failures back off exponentially to a ceiling and give up after
 *    `LIVE_POLL_MAX_FAILURES`, surfacing a keyboard-reachable retry rather than spinning.
 *
 * The store value context is created once and never replaced. If poll state lived in the same
 * context, every tick would invalidate every consumer and the slice-level subscriptions would
 * be pointless — hence the second, separately-consumed connection context.
 */

export function LiveMatchProvider({
  matchId,
  locale,
  initialSnapshot,
  pollIntervalMs = LIVE_POLL_INTERVAL_MS,
  children,
}: {
  matchId: number;
  locale: string;
  initialSnapshot: LiveMatchSnapshot;
  pollIntervalMs?: number;
  children: ReactNode;
}) {
  const [store] = useState(() => createLiveStore(initialSnapshot));
  const [connection, setConnection] = useState<LiveConnectionState>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  const failuresRef = useRef(0);
  failuresRef.current = failures;

  const retry = useCallback(() => {
    setFailures(0);
    failuresRef.current = 0;
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!store.getSnapshot().status.isLive) {
      setConnection("stopped");
      return;
    }
    if (failuresRef.current >= LIVE_POLL_MAX_FAILURES) {
      setConnection("error");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const delay = () =>
      Math.min(
        pollIntervalMs * Math.max(1, 2 ** failuresRef.current),
        LIVE_POLL_MAX_INTERVAL_MS
      );

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(run, delay());
    };

    const run = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule();
        return;
      }
      setConnection("polling");
      try {
        const response = await fetch(
          liveMatchApiPath(matchId, { revision: store.getSnapshot().revision }),
          { signal: controller.signal, headers: { accept: "application/json" } }
        );
        if (!response.ok) throw new Error(`live update failed: ${response.status}`);
        const payload = (await response.json()) as { snapshot?: LiveMatchSnapshot };
        if (cancelled) return;
        if (payload.snapshot) store.apply(payload.snapshot);
        setLastCheckedAt(new Date().toISOString());
        failuresRef.current = 0;
        setFailures(0);
        if (!store.getSnapshot().status.isLive) {
          setConnection("stopped");
          cancelled = true;
          return;
        }
        setConnection("idle");
        schedule();
      } catch (error) {
        if (cancelled || (error as { name?: string })?.name === "AbortError") return;
        const next = failuresRef.current + 1;
        failuresRef.current = next;
        setFailures(next);
        if (next >= LIVE_POLL_MAX_FAILURES) {
          setConnection("error");
          return;
        }
        setConnection("idle");
        schedule();
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timer) clearTimeout(timer);
      void run();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, pollIntervalMs, retryToken, store]);

  const storeValue = useMemo(
    () => ({ store, matchId, locale }),
    [store, matchId, locale]
  );
  const connectionValue = useMemo(
    () => ({ connection, lastCheckedAt, consecutiveFailures: failures, retry }),
    [connection, lastCheckedAt, failures, retry]
  );

  return (
    <LiveStoreContext.Provider value={storeValue}>
      <LiveConnectionContext.Provider value={connectionValue}>
        {children}
      </LiveConnectionContext.Provider>
    </LiveStoreContext.Provider>
  );
}
