import Link from "next/link";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";

/**
 * Acca Studio + Builder entry — manual workspace and automatic generation.
 *
 * REBRAND V2 — THE QUIETEST REGISTER ON THE PAGE.
 *
 * This was a card: rounded, on its own tinted ground, with a filled green button and a second
 * outlined one. Every one of those devices is emphasis, and the map spends none of it here — the
 * accumulator entry is a commercial funnel sitting after every research surface, and affiliate is
 * never the hero. What replaces it is a rule, a mono label and running text with its links set in
 * the page's own ink.
 *
 * The links are still plainly links: each is underlined by a 2px rule at full ink weight, which is
 * the map's own treatment. That is deliberately not colour — WCAG 1.4.1 is satisfied by the
 * underline rather than by a hue, which is what lets this block hold the quietest register without
 * making its actions harder to find.
 */
export function HomepageAccaEntry({
  locale,
  title,
  body,
  ctaLabel,
}: {
  locale: string;
  title: string;
  body: string;
  ctaLabel: string;
}) {
  return (
    <section
      data-analytics-section="acca_entry"
      aria-labelledby="acca-entry-heading"
      className="mt-12 border-t-[0.5px] border-[var(--hero-ink-2)] pt-2"
    >
      <div className="rw-m max-w-[72ch] normal-case leading-[1.8] tracking-[0.04em] text-[var(--hero-ink-2)]">
        <h2 id="acca-entry-heading" className="inline uppercase tracking-[0.14em]">
          {title}
        </h2>{" "}
        — {body}{" "}
        <SectionTrackLink
          href={`/${locale}/acca`}
          section="acca_entry"
          locale={locale}
          className="border-b-2 border-[var(--hero-ink)] font-bold text-[var(--hero-ink)]"
        >
          {ctaLabel} <span aria-hidden className="rw-arrow">→</span>
        </SectionTrackLink>{" "}
        ·{" "}
        <Link
          href={`/${locale}/acca/builder`}
          className="border-b-2 border-[var(--hero-ink)] font-bold text-[var(--hero-ink)]"
        >
          Auto Acca Builder <span aria-hidden className="rw-arrow">→</span>
        </Link>
        {/*
          THE "/combo" NOTE IS GONE FROM READER COPY.

          It read "Legacy /combo redirects to the same builder." — a routing fact, addressed to
          whoever maintains the redirect rather than to anyone reading a football page. A reader
          who lands on /combo arrives at the builder without being told, which is what a redirect
          is for; a reader who never types it learns a URL that does not exist any more.

          The redirect itself is untouched. `comboUi.test.ts` still pins it, against the route
          rather than against a sentence in the page — where it belonged.
        */}
      </div>
    </section>
  );
}
