"use client";

import { useEffect } from "react";
import { trackMatchDetailViewed } from "@/lib/fixtures/analytics";

export function MatchDetailTracker(props: {
  matchId: number;
  locale: string;
  league: string;
  country: string;
  market: string | null;
  source: string | null;
  lifecycle: string;
}) {
  useEffect(() => {
    trackMatchDetailViewed(props);
    // One-shot page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.matchId]);
  return null;
}
