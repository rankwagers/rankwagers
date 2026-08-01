"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function HomepageDateControl({
  locale,
  selectedDate,
  today,
}: {
  locale: Locale;
  selectedDate: string;
  today: string;
}) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
      <span className="whitespace-nowrap font-medium uppercase tracking-label text-muted-foreground">
        Research date
      </span>
      <input
        type="date"
        name="date"
        value={selectedDate}
        max={today}
        onChange={(event) => {
          const next = event.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
          const params = new URLSearchParams(window.location.search);
          if (next === today) params.delete("date");
          else params.set("date", next);
          // Preserve fixture/market deep-link params when changing date.
          const query = params.toString();
          router.push(query ? `/${locale}?${query}` : `/${locale}`);
        }}
        className="rounded-md border border-border bg-[var(--canvas-secondary)] px-2 py-1.5 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
      />
    </label>
  );
}
