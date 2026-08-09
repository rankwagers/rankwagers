"use client";

import { useEffect, useState } from "react";

/*
 * ONE CLOCK. Stored data is UTC; the page renders viewer-local. A server component cannot know
 * the viewer's zone, so this client leaf renders the instant in explicit UTC on the server pass
 * (deterministic markup, honest if JavaScript never arrives) and re-renders in the viewer's own
 * zone after hydration. The record's stamps stay in labeled UTC where archival precision
 * matters — that carve-out lives in `FixtureRecordSection`, not here.
 */
export function LocalTime({ iso, locale }: { iso: string | null; locale?: string }) {
  const parsed = iso ? new Date(iso) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const utcText = valid
    ? `${new Intl.DateTimeFormat(locale ?? "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(valid)} UTC`
    : null;

  const [text, setText] = useState<string | null>(utcText);
  useEffect(() => {
    if (!valid) return;
    setText(
      new Intl.DateTimeFormat(locale ?? undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(valid)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, locale]);

  if (!utcText) return <>—</>;
  return <span suppressHydrationWarning>{text}</span>;
}
