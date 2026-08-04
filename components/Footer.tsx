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
        <div className="mb-8 max-w-2xl border-l-2 border-white/20 py-1 pl-5">
          <div className="rw-label text-white/45">
            {dict.footer.affiliateNotice}
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-white/70">
            {dict.footer.disclaimer}
          </p>
        </div>
        <div className="mb-6">
          <EligibilityNotice dict={dict} />
        </div>

        <div className="mb-10 grid gap-8 sm:grid-cols-2">
          <nav aria-label="Research">
            <p className="rw-m mb-4 text-white/45">Research</p>
            <ul className="flex flex-col gap-2">
              {explore.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-white/70 transition-colors duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Method and legal">
            <p className="rw-m mb-4 text-white/45">Method and legal</p>
            <ul className="flex flex-col gap-2">
              {trust.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-white/70 transition-colors duration-[var(--dur-respond)] ease-[var(--ease-respond)] hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/12 pt-7 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-medium text-white/70">
            <span className="rounded-full border border-white/25 px-2 py-0.5 text-xs font-semibold">
              18+
            </span>
            {dict.footer.ageWarning}
          </span>
          <span className="rw-h text-[17px] text-white">RankWagers</span>
          <span className="text-xs text-white/45">{formatDict(dict.footer.copyright, { year })}</span>
        </div>
      </div>
    </footer>
  );
}
