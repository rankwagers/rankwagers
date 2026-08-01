"use client";

import { useEffect } from "react";
import { trackMarketPageView } from "@/lib/analytics/marketPages";

export function MarketPageTracker({
  marketSlug,
  locale,
}: {
  marketSlug: string;
  locale: string;
}) {
  useEffect(() => {
    trackMarketPageView({ marketSlug, locale });
  }, [marketSlug, locale]);
  return null;
}
