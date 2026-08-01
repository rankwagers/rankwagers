"use client";

import { useEffect } from "react";
import { trackArchiveEvent } from "@/lib/archive/analytics";

export function ArchiveViewTracker({
  locale,
  kind,
  date,
}: {
  locale: string;
  kind: "hub" | "day" | "methodology" | "transparency";
  date?: string;
}) {
  useEffect(() => {
    if (kind === "hub") {
      trackArchiveEvent("archive_viewed", { locale });
      trackArchiveEvent("transparency_viewed", { locale });
    } else if (kind === "day") {
      trackArchiveEvent("archive_day_viewed", {
        locale,
        properties: { date: date ?? null },
      });
    } else if (kind === "methodology") {
      trackArchiveEvent("methodology_viewed", { locale });
    } else {
      trackArchiveEvent("transparency_viewed", { locale });
    }
  }, [locale, kind, date]);

  return null;
}
