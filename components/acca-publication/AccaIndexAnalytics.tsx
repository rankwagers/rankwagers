"use client";

import { useEffect, useRef } from "react";
import { trackPublicAccaEvent } from "@/lib/acca-publication/analytics";
import {
  IMPRESSION_INTERSECTION_THRESHOLD,
  rememberImpression,
} from "@/lib/analytics/impressions";

/**
 * Analytics island for the public Acca index (Sprint 24).
 *
 * RENDERS NOTHING. It returns `null` and reads the DOM the server already produced, so measuring
 * the page costs no hydration of the page's CONTENT. Wrapping each card in a client component
 * would have been simpler to write and would have shipped every card's markup to the browser
 * twice — for a feature whose whole point is that the index works without JavaScript.
 *
 * DUPLICATE SUPPRESSION, on three axes:
 *
 *   view         keyed on locale + page number + whether the reader filtered, so a re-render or a
 *                React StrictMode double-effect fires once, and paging to page 2 fires once more
 *                because it genuinely is a different view.
 *   impression   keyed on the public id through the shared `rememberImpression` set, which
 *                survives paging, and the element is unobserved after its first crossing.
 *   click        one delegated listener on the document rather than one per card, so the count
 *                cannot drift with the number of cards rendered.
 *
 * PRIVACY. Every value comes from a `data-` attribute the server put there deliberately. Nothing
 * reads the URL, the referrer, form values or page text.
 */

type CardContext = {
  publicAccaId: string;
  profile?: string;
  legCount?: number;
  oddsBand?: string;
  freshnessState?: string;
  position?: number;
};

function cardContext(element: HTMLElement): CardContext | null {
  const publicAccaId = element.dataset.accaId;
  if (!publicAccaId) return null;
  const legCount = Number(element.dataset.accaLegs);
  const position = Number(element.dataset.accaPosition);
  return {
    publicAccaId,
    profile: element.dataset.accaProfile || undefined,
    legCount: Number.isFinite(legCount) ? legCount : undefined,
    oddsBand: element.dataset.accaBand || undefined,
    freshnessState: element.dataset.accaState || undefined,
    position: Number.isFinite(position) ? position : undefined,
  };
}

export function AccaIndexAnalytics({
  locale,
  page,
  resultCount,
  filtered,
}: {
  locale: string;
  page: number;
  resultCount: number;
  filtered: boolean;
}) {
  const viewKey = `${locale}:${page}:${filtered ? "filtered" : "all"}`;
  const lastViewKey = useRef<string | null>(null);
  const seenImpressions = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (lastViewKey.current === viewKey) return;
    lastViewKey.current = viewKey;
    trackPublicAccaEvent("acca_index_view", {
      surface: "acca_index",
      locale,
      page,
      resultCount,
      filtered,
    });
  }, [viewKey, locale, page, resultCount, filtered]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-acca-card]"));
    if (cards.length === 0) return;
    const seen = seenImpressions.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          const context = cardContext(element);
          // Unobserve regardless: a card that crossed the threshold has been counted or is not
          // measurable, and either way watching it again cannot produce a new fact.
          observer.unobserve(element);
          if (!context) continue;
          if (!rememberImpression(seen, context.publicAccaId)) continue;
          trackPublicAccaEvent("acca_card_impression", {
            ...context,
            surface: "acca_index",
            locale,
          });
        }
      },
      { threshold: IMPRESSION_INTERSECTION_THRESHOLD },
    );
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [viewKey, locale]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!link) return;

      if (link.closest("[data-acca-builder-entry]")) {
        trackPublicAccaEvent("acca_builder_entry_click", {
          surface: "acca_index",
          locale,
        });
        return;
      }
      const card = link.closest<HTMLElement>("[data-acca-card]");
      if (!card) return;
      const context = cardContext(card);
      if (!context) return;
      trackPublicAccaEvent("acca_card_click", { ...context, surface: "acca_index", locale });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [locale]);

  return null;
}
