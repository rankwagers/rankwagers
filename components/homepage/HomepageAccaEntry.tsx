import Link from "next/link";
import { SectionTrackLink } from "@/components/analytics/SectionTrackLink";

/** Acca Studio + Builder entry — manual workspace and automatic generation. */
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
      className="border-t border-[var(--border-subtle)] py-8"
    >
      <div className="rounded-lg border border-border bg-[var(--canvas-secondary)] px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="max-w-2xl">
          <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
            Accumulators
          </p>
          <h2
            id="acca-entry-heading"
            className="mt-1 font-display text-xl font-semibold text-foreground"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">{body}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:items-end">
          <SectionTrackLink
            href={`/${locale}/acca`}
            section="acca_entry"
            locale={locale}
            className="inline-flex min-h-11 items-center rounded-md border border-brand/35 bg-[var(--green-surface)] px-4 text-sm font-semibold text-brand"
          >
            {ctaLabel}
          </SectionTrackLink>
          <Link
            href={`/${locale}/acca/builder`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground hover:border-brand/40"
          >
            Auto Acca Builder
          </Link>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Build manually in accumulators, or generate ranked combinations in the{" "}
        <Link
          href={`/${locale}/acca/builder`}
          /*
           * Underlined always, not only on hover. This link sits inside a paragraph, and its
           * brand green carries only 1.23:1 against the surrounding muted text — so before hover
           * there was nothing but colour marking it as a link, which is WCAG 1.4.1 (Use of
           * Colour). Standalone brand links elsewhere are not in a text block and are unaffected.
           */
          className="text-brand underline"
        >
          Evidence-Based Acca Builder
        </Link>
        . Legacy /combo redirects to the same builder.
      </p>
    </section>
  );
}
