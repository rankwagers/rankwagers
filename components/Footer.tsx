import Link from "next/link";
import { formatDict } from "@/lib/dictionaryExtras";
import { GambleAwareNotice } from "@/components/GambleAwareNotice";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

const FOOTER_STRAPLINE = "Football, read as evidence";

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
    /*
     * The inverted ground. `bg-ink` is the prototype's rarest punctuation — one band at the foot
     * of the page reads as a close; used more often it would read as a theme. `.rw-hero` scopes
     * the palette and type, and the contrast pairs here are chosen against #0b0c0e rather than
     * inherited from the light surface (white/55 and white/70 clear AA on this ground; the
     * shipped --ink-secondary would not).
     *
     * Structure is unchanged — same notices, same two navs, same legal row.
     */
    <footer className="rw-hero mt-16 bg-[var(--hero-ink)] text-white lg:mt-24">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-16 text-sm text-white/60 lg:px-8 lg:py-20">
        <GambleAwareNotice />
        {/*
          THE TWO DISCLOSURES, side by side on left rules — the map's geometry.

          The eligibility notice lost its GREY PANEL. On an inverted ground a light card is the
          brightest object in the footer, which ranked a legal notice above the wordmark beside it;
          and the panel was the last rounded box below the live desk. Both disclosures now carry
          the same 2px left rule, which is what states them as a pair.
        */}
        <div className="mb-8 grid gap-8 border-b border-white/20 pb-7 sm:grid-cols-2">
          <div className="border-l-2 border-white/60 pl-4">
            <p className="rw-m text-white/55">{dict.footer.affiliateNotice}</p>
            <p className="mt-2 text-[13px] leading-[1.6] text-white/80">{dict.footer.disclaimer}</p>
          </div>
          <div className="border-l-2 border-white/60 pl-4">
            <p className="rw-m text-white/55">{dict.footer.eligibilityTitle}</p>
            <p className="mt-2 text-[13px] leading-[1.6] text-white/80">
              {dict.footer.eligibilityBody}
            </p>
          </div>
        </div>

        <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_minmax(0,1.2fr)]">
          <nav aria-label="Research">
            <p className="rw-m mb-3.5 text-white/55">Research</p>
            <ul className="flex flex-col gap-2">
              {explore.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] text-white/75 transition-colors duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Method and legal">
            <p className="rw-m mb-3.5 text-white/55">Method and legal</p>
            <ul className="flex flex-col gap-2">
              {trust.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] text-white/75 transition-colors duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/*
            THE MASTHEAD WORDMARK, at the map's 34px in full white — the footer's counterweight to
            the one that opens the page. It was set at 17px in the legal row, where it read as a
            byline rather than as the publication signing off.
          */}
          <div className="sm:col-span-2 lg:col-span-1 lg:text-right">
            <p className="rw-h text-[34px] text-white">RankWagers</p>
            <p className="rw-m mt-2 text-white/55">{FOOTER_STRAPLINE}</p>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/20 pt-5 sm:flex-row sm:items-center">
          <span className="rw-m inline-flex items-center gap-2.5 text-white/55">
            <span className="border border-white/50 px-1.5 py-0.5 text-white/80">18+</span>
            {dict.footer.ageWarning}
          </span>
          <span className="rw-m text-white/55">{formatDict(dict.footer.copyright, { year })}</span>
        </div>
      </div>
    </footer>
  );
}
