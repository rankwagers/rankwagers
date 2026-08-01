"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

export function HomepageSearchEntry({
  locale,
  placeholder,
  submitLabel,
}: {
  locale: string;
  placeholder: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      className="flex w-full max-w-md gap-2"
      role="search"
      aria-label="Fixture search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        trackAnalyticsEvent({
          event_name: "search_submitted",
          fixture_id: null,
          market: null,
          operator_slug: null,
          locale,
          user_id: null,
          properties: { surface: "homepage_hero", query_length: trimmed.length },
        });
        if (!trimmed) {
          router.push(`/${locale}#fixtures`);
          return;
        }
        window.dispatchEvent(
          new CustomEvent("rankwagers:home-search", { detail: { query: trimmed } })
        );
        router.push(`/${locale}#fixtures`);
      }}
    >
      <label htmlFor="homepage-hero-search" className="sr-only">
        {placeholder}
      </label>
      <input
        id="homepage-hero-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 flex-1 rounded-md border border-border bg-[var(--canvas-primary)] px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-md border border-brand/30 bg-[var(--green-surface)] px-4 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {submitLabel}
      </button>
    </form>
  );
}
