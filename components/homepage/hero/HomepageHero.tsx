import type { FullDictionary } from "@/lib/dictionaries";
import type { DailyMatchLists } from "@/lib/footystats/types";
import type { Locale } from "@/lib/i18n";
import { buildHomepageHeroModel } from "@/lib/homepage/heroModel";
import { formatDict } from "@/lib/dictionaryExtras";
import { HeroStage } from "./HeroStage";

/**
 * S1 — Hero.
 *
 * Server boundary for the approved hero composition: it derives the model from the day's lists
 * that the page has already fetched — no extra request, no new failure mode — resolves copy from
 * the dictionary, and hands both to the interactive stage.
 *
 * The stage below is a client component because the selection drives the instrument, but it is
 * still server-rendered into the initial HTML, so the H1 is present for crawlers and paints
 * without waiting for hydration.
 */
export function HomepageHero({
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

  return (
    <HeroStage
      model={model}
      locale={locale}
      headingId={headingId}
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
        // Existing approved terminology for exactly this figure — not new copy.
        probabilityNote: p.colPctTooltip,
      }}
    />
  );
}
