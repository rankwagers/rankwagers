import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { COUNTRY_LOCALE } from "@/lib/countries";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  const dict = getDictionary(params.locale);
  return pageMetadata({
    locale: params.locale,
    path: "/availability",
    title: `${dict.footer.geo} — ${dict.meta.siteName}`,
    description: dict.footer.availabilityBody.slice(0, 160),
  });
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const dict = getDictionary(params.locale);
  const countries = Object.keys(COUNTRY_LOCALE).sort();
  return (
    <article className="container-wide max-w-3xl">
      <p className="text-metadata font-medium uppercase tracking-label text-brand">
        Availability
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
        {dict.footer.geo}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
        {dict.footer.availabilityBody}
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Country codes below indicate locales we personalize for. Operator registration
        decisions remain with each sportsbook.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {countries.map((c) => (
          <span
            key={c}
            className="rounded-md border border-border bg-[var(--canvas-secondary)] px-2.5 py-1 font-mono text-sm text-foreground"
          >
            {c}
          </span>
        ))}
      </div>
    </article>
  );
}
