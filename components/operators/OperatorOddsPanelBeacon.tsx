"use client";

import { useEffect, useRef } from "react";
import { trackOperatorOddsPanelInteraction } from "@/lib/analytics/operatorPages";

/** Fires once when an odds panel section becomes visible. */
export function OperatorOddsPanelBeacon({
  operatorSlug,
  locale,
  panel,
}: {
  operatorSlug: string;
  locale: string;
  panel: string;
}) {
  const sent = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (sent.current) return;
        if (!entries.some((entry) => entry.isIntersecting)) return;
        sent.current = true;
        trackOperatorOddsPanelInteraction({ operatorSlug, locale, panel });
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [operatorSlug, locale, panel]);

  return <span ref={ref} className="sr-only" aria-hidden />;
}
