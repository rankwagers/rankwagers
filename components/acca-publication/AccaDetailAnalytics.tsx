"use client";

import { useEffect, useRef } from "react";
import {
  trackPublicAccaEvent,
  type PublicAccaAnalyticsProperties,
} from "@/lib/acca-publication/analytics";
import { rememberImpression } from "@/lib/analytics/impressions";

/**
 * Analytics island for a public Acca detail page (Sprint 24).
 *
 * RENDERS NOTHING, for the same reason as the index island: the page's content must not be
 * hydrated to be measured.
 *
 * WHY THE DISCLOSURE LISTENERS ARE ATTACHED PER ELEMENT
 *
 * The `toggle` event of `<details>` does NOT bubble, so the delegated-listener pattern used for
 * card clicks silently measures nothing here. Each disclosure gets its own listener, attached
 * after render and removed on cleanup. The disclosures themselves stay native `<details>`
 * elements — keyboard-operable, screen-reader-announced and fully functional with JavaScript
 * disabled, which a custom ARIA widget would not be.
 *
 * Expansion is counted ONCE per disclosure per page lifecycle: opening, closing and reopening the
 * same selection is one act of reading it, not three.
 */

export type AccaDetailAnalyticsContext = Omit<
  PublicAccaAnalyticsProperties,
  "surface" | "position" | "page" | "resultCount" | "filtered" | "shareMethod"
>;

export function AccaDetailAnalytics({ context }: { context: AccaDetailAnalyticsContext }) {
  const lastViewKey = useRef<string | null>(null);
  const expanded = useRef<Set<string>>(new Set());

  const viewKey = `${context.locale ?? ""}:${context.publicAccaId ?? ""}`;

  useEffect(() => {
    if (lastViewKey.current === viewKey) return;
    lastViewKey.current = viewKey;
    trackPublicAccaEvent("acca_detail_view", { ...context, surface: "acca_detail" });
    // `context` is a fresh object every render; `viewKey` is the stable identity of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("details[data-acca-disclosure]"),
    );
    if (nodes.length === 0) return;
    const seen = expanded.current;

    const bound = nodes.map((node) => {
      const handler = () => {
        if (!node.open) return;
        const kind = node.dataset.accaDisclosure;
        const rawPosition = Number(node.dataset.accaPosition);
        const position = Number.isFinite(rawPosition) ? rawPosition : undefined;
        if (!rememberImpression(seen, `${kind}:${position ?? "0"}`)) return;
        trackPublicAccaEvent(
          kind === "leg" ? "acca_leg_expand" : "acca_evidence_expand",
          { ...context, surface: "acca_detail", position },
        );
      };
      node.addEventListener("toggle", handler);
      return { node, handler };
    });

    return () => {
      for (const { node, handler } of bound) node.removeEventListener("toggle", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  return null;
}
