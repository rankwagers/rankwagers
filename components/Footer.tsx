import Link from "next/link";
import { formatDict } from "@/lib/dictionaryExtras";
import { GambleAwareNotice } from "@/components/GambleAwareNotice";
import { EligibilityNotice } from "@/components/EligibilityNotice";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export function Footer({
  dict,
  locale,
}: {
  dict: FullDictionary;
  locale: Locale;
}) {
  const year = new Date().getFullYear().toString();
  const explore = [
    { href: `/${locale}`, label: "Today's fixtures" },
    { href: `/${locale}/competitions`, label: "Competitions" },
    { href: `/${locale}/markets`, label: "Markets" },
    { href: `/${locale}/teams`, label: "Teams" },
    { href: `/${locale}/countries`, label: "Countries" },
    { href: `/${locale}/operators`, label: "Operators" },
    { href: `/${locale}/search`, label: "Search" },
    { href: `/${locale}/best-betting-sites`, label: "Assessments" },
    { href: `/${locale}/bonuses`, label: "Promotions" },
    { href: `/${locale}/acca`, label: "Accumulators" },
    { href: `/${locale}/acca/builder`, label: "Build accumulator" },
  ];
  const trust = [
    { href: `/${locale}/methodology`, label: "Methodology" },
    { href: `/${locale}/archive`, label: "Archive" },
    { href: `/${locale}#verified-performance`, label: "Settled record" },
    { href: `/${locale}/responsible-gambling`, label: dict.footer.responsible },
    { href: `/${locale}/terms`, label: dict.footer.terms },
    { href: `/${locale}/privacy`, label: dict.footer.privacy },
    { href: `/${locale}/availability`, label: dict.footer.geo },
  ];

  return (
    <footer className="mt-12 border-t border-[var(--border-subtle)] bg-[var(--canvas-secondary)]">
      <div className="container-wide py-12 text-sm text-muted-foreground">
        <GambleAwareNotice />
        <div className="mb-8 max-w-2xl rounded-lg border border-[var(--border-subtle)] bg-background p-4">
          <div className="text-metadata font-medium uppercase tracking-label text-brand">
            {dict.footer.affiliateNotice}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
            {dict.footer.disclaimer}
          </p>
        </div>
        <div className="mb-6">
          <EligibilityNotice dict={dict} />
        </div>

        <div className="mb-10 grid gap-8 sm:grid-cols-2">
          <nav aria-label="Research">
            <p className="mb-3 text-metadata font-medium uppercase tracking-label text-foreground">
              Research
            </p>
            <ul className="flex flex-col gap-2">
              {explore.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-[var(--ink-secondary)] hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Method and legal">
            <p className="mb-3 text-metadata font-medium uppercase tracking-label text-foreground">
              Method and legal
            </p>
            <ul className="flex flex-col gap-2">
              {trust.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-[var(--ink-secondary)] hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-medium text-brand">
            <span className="rounded-full border border-brand/25 px-2 py-0.5 text-xs font-semibold">
              18+
            </span>
            {dict.footer.ageWarning}
          </span>
          <span className="font-display text-sm text-foreground">RankWagers</span>
          <span className="text-xs">{formatDict(dict.footer.copyright, { year })}</span>
        </div>
      </div>
    </footer>
  );
}
