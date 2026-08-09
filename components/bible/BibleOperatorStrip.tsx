import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import type { CountryContext } from "@/lib/personalization/types";
import { getHomepageOperators } from "@/lib/personalization/homepage";

/** Editorial operator discovery — contextual cards, not banner spam. */
export function BibleOperatorStrip({
  dict,
  locale,
  subidBase,
  countryContext,
}: {
  dict: FullDictionary;
  locale: Locale;
  subidBase: string;
  countryContext: CountryContext;
}) {
  const p = dict.predictions;
  const operators = getHomepageOperators(countryContext, 3, subidBase);

  return (
    /*
       REBRAND V2 — THE QUIETEST REGISTER.

       Three cards became three ruled rows. The map gives operators a mono list under a hairline:
       a number, a name, a line of description, and a link out. No card ground, no logo plate, no
       coloured "Continue" — every one of those was emphasis spent on the commercial block, and
       the brief puts affiliate last precisely so it does not compete with the research above it.

       The logo goes with them. A 40px mark on a tinted square is brand furniture, and it is the
       one thing in this list that could out-weigh the research table two sections up.
    */
    <section
      id="operators"
      aria-labelledby="bible-operators-heading"
      className="mt-16"
    >
      <div className="rw-m flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-[0.5px] border-[var(--hero-ink-2)] pb-2 text-[var(--hero-ink-2)]">
        <h2 id="bible-operators-heading" className="uppercase tracking-[0.14em]">
          {p.bibleOperatorsTitle}
        </h2>
        <Link
          href={`/${locale}/operators`}
          className="font-bold text-[var(--hero-ink)]"
        >
          {p.bibleOperatorsCompareLink} <span aria-hidden className="rw-arrow">→</span>
        </Link>
      </div>
      <p className="rw-m mt-2 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
        Editorial options for {countryContext.country}. Research above is separate from commercial
        offers.
      </p>

      {/* The rows: number, name, description, link. Mono throughout, hairline between peers. */}
      <ul className="mt-3">
        {operators.map((operator, index) => (
          <li key={operator.slug}>
            <a
              href={operator.outboundPath}
              className="rw-row grid grid-cols-[36px_minmax(0,1fr)_auto] items-baseline gap-x-3.5 border-b-[0.5px] border-[var(--hero-line)] py-2.5 pl-3.5"
              aria-label={`${operator.name} — continue to sportsbook`}
              rel="noopener sponsored"
            >
              <span className="rw-tnum rw-m text-[var(--hero-ink-2)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="text-[13px] font-semibold text-[var(--hero-ink)]">
                  {operator.name}
                </span>
                <span className="rw-m ml-3 text-[var(--hero-ink-2)]">
                  {operator.highlights[0] ?? "Licensed sportsbook partner"}
                </span>
              </span>
              <span className="rw-m text-[var(--hero-ink)]">
                Continue <span aria-hidden className="rw-arrow">→</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

    </section>
  );
}
