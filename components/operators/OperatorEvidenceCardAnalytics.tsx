"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IMPRESSION_INTERSECTION_THRESHOLD } from "@/lib/analytics/impressions";
import {
  trackOperatorCardEvidenceExpand,
  trackOperatorCardImpression,
  trackOperatorCardPrimaryClick,
  trackOperatorCardSecondaryClick,
  type OperatorCardContext,
} from "@/lib/analytics/operatorCard";

/**
 * Analytics shell for an operator evidence card (Sprint 21).
 *
 * This wrapper exists ONLY to observe. All card content is passed through as `children` and is
 * rendered on the server, so the card is fully present in the HTML a crawler receives and remains
 * readable with JavaScript disabled. The "Why this operator?" disclosure is a native
 * `<details>/<summary>` in the server component — it opens without this component being mounted.
 *
 * Event delegation is used rather than prop-drilling handlers into the server-rendered markup,
 * because a server component cannot be handed a function. Listeners are attached to the wrapper and
 * the originating element is identified by `data-operator-cta`.
 */
export function OperatorEvidenceCardAnalytics({
  context,
  children,
}: {
  context: OperatorCardContext;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Kept in a ref so the effects below never re-subscribe when a parent re-renders with an
  // equivalent-but-new context object.
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // Older browsers and JSDOM: count the impression rather than losing it silently.
      trackOperatorCardImpression(contextRef.current);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          trackOperatorCardImpression(contextRef.current);
          observer.disconnect();
        }
      },
      { threshold: IMPRESSION_INTERSECTION_THRESHOLD },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const cta = target.closest("[data-operator-cta]");
      if (!cta || !node.contains(cta)) return;
      const kind = cta.getAttribute("data-operator-cta");
      if (kind === "primary") trackOperatorCardPrimaryClick(contextRef.current);
      else if (kind === "secondary") trackOperatorCardSecondaryClick(contextRef.current);
    };

    // `toggle` does not bubble, so it is captured. Only the opening transition is reported —
    // a reader collapsing and reopening the same block has not discovered the evidence twice.
    const onToggle = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLDetailsElement)) return;
      if (!node.contains(target)) return;
      if (target.open) trackOperatorCardEvidenceExpand(contextRef.current);
    };

    node.addEventListener("click", onClick);
    node.addEventListener("toggle", onToggle, true);
    return () => {
      node.removeEventListener("click", onClick);
      node.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
