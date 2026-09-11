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
    <article style={{ paddingBottom: 80 }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label" style={{ margin: 0 }}>
          Availability
        </p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0", color: "var(--text)" }}>
          {dict.footer.geo}
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            maxWidth: "62ch",
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--muted)",
          }}
        >
          {dict.footer.availabilityBody}
        </p>
      </header>
      <p className="rw3-meta" style={{ margin: 0, padding: "14px 20px 0" }}>
        Country codes below indicate locales we personalize for. Operator registration
        decisions remain with each sportsbook.
      </p>
      <div className="flex flex-wrap gap-2" style={{ padding: "12px 20px 0" }}>
        {countries.map((c) => (
          <span
            key={c}
            className="rw3-pill font-mono"
            style={{ background: "var(--surface)" }}
          >
            {c}
          </span>
        ))}
      </div>
    </article>
  );
}
