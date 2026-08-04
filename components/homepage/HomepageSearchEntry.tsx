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
        className="min-h-11 flex-1 border-b-[1.5px] border-[var(--hero-ink)] bg-transparent px-0 text-[14px] text-[var(--hero-ink)] placeholder:text-[var(--hero-ink-2)]"
      />
      <button
        type="submit"
        className="rw-m min-h-11 shrink-0 border-b-[1.5px] border-[var(--hero-ink)] px-0 font-bold text-[var(--hero-ink)]"
      >
        {submitLabel}
      </button>
    </form>
  );
}
