"use client";

import { useEffect } from "react";
import { trackOperatorPageView } from "@/lib/analytics/operatorPages";

export function OperatorPageTracker({
  operatorSlug,
  locale,
}: {
  operatorSlug: string;
  locale: string;
}) {
  useEffect(() => {
    trackOperatorPageView({ operatorSlug, locale });
  }, [operatorSlug, locale]);
  return null;
}
