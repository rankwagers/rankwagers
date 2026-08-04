import type { FullDictionary } from "@/lib/dictionaries";
import type { DailyMatchLists } from "@/lib/footystats/types";
import type { Locale } from "@/lib/i18n";
import { venueRatesForMarket, type VenueRates } from "@/lib/fixtures/evidenceView";
import { getMatchDetails } from "@/lib/footystats/matchDetail";
import { buildHomepageHeroModel } from "@/lib/homepage/heroModel";
import { formatDict } from "@/lib/dictionaryExtras";
import { HeroStage } from "./HeroStage";

/**
 * S1 — Hero.
 *
 * Server boundary for the approved hero composition: it derives the model from the day's lists
 * that the page has already fetched, resolves copy from the dictionary, and hands both to the
 * interactive stage.
 *
 * The stage below is a client component because the selection drives the instrument, but it is
 * still server-rendered into the initial HTML, so the H1 is present for crawlers and paints
 * without waiting for hydration.
 *
 * THE ONE REQUEST THIS BOUNDARY MAKES.
 * The venue rates beside the dial — the home side at home, the away side away, the league — do
 * not exist in the daily lists. Those lists carry a market-potential percentage per fixture and
 * no sample, and a rate published without its sample is exactly what §3.2 forbids. So the rates
 * come from the same provider detail the fixture page reads, through the same cached,
 * concurrency-bounded, failure-isolated helper: a fixture whose detail does not resolve is simply
 * absent from the map, and the stage omits its slot rather than drawing a dash or a zero.
 *
 * The enrichment is bounded by the pick count (five), so it is a fixed cost rather than one that
 * grows with the day's fixture list, and it resolves on the server — the slots are filled in the
 * first paint, so no figure arrives late and nothing reflows.
 */
export async function HomepageHero({
  lists,
  dict,
  locale,
  headingId,
}: {
  lists: DailyMatchLists;
  dict: FullDictionary;
  locale: Locale;
  headingId: string;
}) {
  const p = dict.predictions;
  const model = buildHomepageHeroModel({ lists, locale });

  /*
   * Retrieval stamp. The provider's own `fetchedAt`, formatted in UTC exactly as the existing
   * `modelMeta` line below the fold does. When the stamp is unusable the label says so rather
   * than inventing a time.
   */
  const updated = model.fetchedAt
    ? formatDict(p.heroStageUpdated, {
        time: new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }).format(new Date(model.fetchedAt)),
      })
    : p.heroStageUpdatedPending;

  const count = model.picks.length;

  /*
   * Venue rates for the ranked picks, keyed by fixture. A pick with no entry, or an entry whose
   * sides hold nothing, renders with its slots empty — never filled in from a neighbour, from the
   * league figure, or from a previous day.
   */
  const details = await getMatchDetails(
    model.picks.map((pick) => pick.matchId),
    locale
  );
  const venueRates: Record<number, VenueRates> = {};
  for (const pick of model.picks) {
    venueRates[pick.matchId] = venueRatesForMarket(details.get(pick.matchId), pick.marketKind);
  }

  return (
    <HeroStage
      model={model}
      locale={locale}
      headingId={headingId}
      venueRates={venueRates}
      copy={{
        eyebrow: p.heroStageEyebrow,
        updated,
        title: p.heroStageTitle,
        lede: p.heroStageLede,
        ledeRest: count
          ? formatDict(p.heroStageLedeRest, { count: String(count) })
          : p.heroStageLedeRestEmpty,
        funnelTitle: p.heroFunnelTitle,
        funnelNote: formatDict(p.heroFunnelNote, {
          count: String(model.funnel.qualified ?? 0),
        }),
        funnelAnalysed: p.heroFunnelAnalysed,
        funnelValidated: p.heroFunnelValidated,
        funnelInScope: p.heroFunnelInScope,
        funnelQualified: p.heroFunnelQualified,
        funnelFeatured: p.heroFunnelFeatured,
        leadTitle: p.heroLeadTitle,
        leadNote: formatDict(p.heroLeadNote, { count: String(count) }),
        supportingTitle: p.heroSupportingTitle,
        supportingNote: formatDict(p.heroSupportingNote, {
          count: String(Math.max(0, count - 1)),
          total: String(count),
        }),
        cta: p.heroStageCta,
        empty: p.heroStageEmpty,
        openResearch: p.heroOpenResearch,
        /*
         * The approved provider-potential qualifier. This read `p.colPctTooltip` — "Model
         * probability for this market…" — which named the figure with the vocabulary reserved for
         * our own model's output and left its missing sample implied. One string, one vocabulary.
         */
        probabilityNote: p.heroProviderPotentialNote,
        venueHome: p.heroVenueHome,
        venueAway: p.heroVenueAway,
        venueLeague: p.heroVenueLeague,
        tableNo: p.heroTableNo,
        tableFixture: p.heroTableFixture,
        tableLeague: p.heroTableLeague,
        tableKickoff: p.heroTableKickoff,
        tablePotential: p.heroTablePotential,
        tableMarket: p.heroTableMarket,
      }}
    />
  );
}
