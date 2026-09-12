import "server-only";

import { unstable_cache } from "next/cache";
import { affiliatePartners, type AffiliatePartner } from "@/lib/affiliate/operators";
import { sortPartnersForCountry } from "@/lib/personalization/ranking";
import type { CountryContext } from "@/lib/personalization/types";
import { buildGoPath } from "@/lib/operators/go-path";
import { getBrand } from "@/lib/brands";
import { bonusForLocale } from "@/lib/bonusForLocale";
import { queryArchive } from "@/lib/archive/load";
import { ARCHIVE_MARKETS } from "@/lib/archive/markets";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   V3 RAIL DATA (Bible V3, shell). Everything here is derived from real
   sources: today's provider lists, the partner registry, and the settled
   archive. A builder that has nothing honest to return returns nothing —
   the rail section then renders its empty state or is omitted (empty-state
   law), never a placeholder.
   ========================================================================== */

/* ── popular leagues ───────────────────────────────────────────────────── */

export type PopularLeague = {
  name: string;
  countryCode: string | null;
  /** Real league mark from the provider image pipeline, when the row carries one. */
  leagueImage: string | null;
  count: number;
};

/** Distinct fixtures per competition across all four list buckets. */
export function buildPopularLeagues(lists: DailyMatchLists, limit = 9): {
  leagues: PopularLeague[];
  totalMatches: number;
} {
  const byLeague = new Map<
    string,
    { countryCode: string | null; leagueImage: string | null; ids: Set<number> }
  >();
  const allIds = new Set<number>();
  const kinds: MatchListKind[] = ["fh", "over15", "over25", "sh"];
  for (const kind of kinds) {
    for (const row of lists[kind] as FootyMatchRow[]) {
      allIds.add(row.matchId);
      const entry = byLeague.get(row.competition) ?? {
        countryCode: row.countryCode ?? null,
        leagueImage: row.leagueImage ?? null,
        ids: new Set<number>(),
      };
      entry.ids.add(row.matchId);
      if (!entry.countryCode && row.countryCode) entry.countryCode = row.countryCode;
      if (!entry.leagueImage && row.leagueImage) entry.leagueImage = row.leagueImage;
      byLeague.set(row.competition, entry);
    }
  }
  const leagues = [...byLeague.entries()]
    .map(([name, entry]) => ({
      name,
      countryCode: entry.countryCode,
      leagueImage: entry.leagueImage,
      count: entry.ids.size,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
  return { leagues, totalMatches: allIds.size };
}

/* ── betting sites (left rail) ─────────────────────────────────────────── */

export type RailSite = {
  slug: string;
  name: string;
  /** Letter fallback when the brand has no logo asset (polish group 1). */
  mark: string;
  /** The real brand asset — the operator cards' own file. */
  logo: string | null;
  offer: string;
  best: boolean;
  continueHref: string;
};

function markFor(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function buildRailSites(
  countryContext: CountryContext,
  locale: Locale,
  limit = 4
): RailSite[] {
  const configured = affiliatePartners.filter(
    (partner) =>
      partner.isConfigured &&
      (!partner.acceptedCountries.length ||
        partner.acceptedCountries.includes(countryContext.country))
  );
  const ranked = sortPartnersForCountry(configured, countryContext).slice(0, limit);
  return ranked.flatMap((partner: AffiliatePartner, index: number) => {
    const brand = getBrand(partner.slug);
    if (!brand) return [];
    return [
      {
        slug: partner.slug,
        name: partner.canonicalName,
        mark: markFor(partner.canonicalName),
        logo: brand.logo ?? null,
        offer: bonusForLocale(brand, locale),
        best: index === 0,
        continueHref: buildGoPath({
          slug: partner.slug,
          placement: "rail_sites",
          subid: `rail-sites_${index + 1}`,
          availability: "unknown",
          deeplinkType: "homepage",
          operatorRank: index + 1,
        }),
      },
    ];
  });
}

/* ── the day's fallback operator (polish group 4) ──────────────────────── */

export type FallbackOperator = {
  slug: string;
  name: string;
  mark: string;
  logo: string | null;
};

/**
 * The operator behind the sponsored no-price fallback: the admin's pinned
 * operator when set and eligible, else the day's Best (top-ranked). The
 * caller signs per surface — one placement (`price_row_fallback`), one
 * subid per row, never a fabricated price. Null when nobody qualifies:
 * the affordance is omitted, not placeholdered.
 */
export function resolveFallbackOperator(
  countryContext: CountryContext,
  pinnedSlug?: string | null
): FallbackOperator | null {
  const configured = affiliatePartners.filter(
    (partner) =>
      partner.isConfigured &&
      (!partner.acceptedCountries.length ||
        partner.acceptedCountries.includes(countryContext.country))
  );
  if (!configured.length) return null;
  const pinned = pinnedSlug
    ? configured.find((partner) => partner.slug === pinnedSlug)
    : undefined;
  const partner = pinned ?? sortPartnersForCountry(configured, countryContext)[0];
  if (!partner) return null;
  const brand = getBrand(partner.slug);
  if (!brand) return null;
  return {
    slug: partner.slug,
    name: partner.canonicalName,
    mark: markFor(partner.canonicalName),
    logo: brand.logo ?? null,
  };
}

/* ── offer of the day ──────────────────────────────────────────────────── */

export type OfferOfTheDay = {
  slug: string;
  name: string;
  mark: string;
  logo: string | null;
  offer: string;
  continueHref: string;
};

export function buildOfferOfTheDay(
  countryContext: CountryContext,
  locale: Locale,
  pinnedSlug?: string | null,
  /** Attribution slot — defaults to the home rail; the match aside passes its own. */
  slot?: { placement: string; subid: string }
): OfferOfTheDay | null {
  const configured = affiliatePartners.filter(
    (partner) =>
      partner.isConfigured &&
      (!partner.acceptedCountries.length ||
        partner.acceptedCountries.includes(countryContext.country))
  );
  if (!configured.length) return null;
  const pinned = pinnedSlug
    ? configured.find((partner) => partner.slug === pinnedSlug)
    : undefined;
  const partner = pinned ?? sortPartnersForCountry(configured, countryContext)[0];
  if (!partner) return null;
  const brand = getBrand(partner.slug);
  if (!brand) return null;
  return {
    slug: partner.slug,
    name: partner.canonicalName,
    mark: markFor(partner.canonicalName),
    logo: brand.logo ?? null,
    offer: bonusForLocale(brand, locale),
    continueHref: buildGoPath({
      slug: partner.slug,
      placement: slot?.placement ?? "offer_of_the_day",
      subid: slot?.subid ?? "offer-of-the-day",
      availability: "unknown",
      deeplinkType: "homepage",
      operatorRank: 1,
    }),
  };
}

/* ── high potential · today (right rail) ───────────────────────────────── */

export type HighPotentialMarket = {
  marketKey: MatchListKind;
  marketLabel: string;
  /** Verified hit rate over the settled archive window — real record, not model output. */
  hitRatePct: number | null;
  won: number;
  lost: number;
  /** Today's qualified predictions in this market's bucket. */
  todayCount: number;
  /** Last settled outcomes, oldest → newest, true = won. Empty when unknown. */
  form: boolean[];
  /** Group 5: fewer than 5 settled — muted pct, never tops the rail. */
  smallSample: boolean;
};

const loadMarketRecord = unstable_cache(
  async (marketKey: string) => {
    const { metrics, page } = await queryArchive(
      "en",
      { market: marketKey },
      { dateLimit: 21 }
    );
    const settled = page.records
      .filter((r) => r.status === "won" || r.status === "lost")
      .sort((a, b) => (b.kickoffAt ?? b.date).localeCompare(a.kickoffAt ?? a.date))
      .slice(0, 10)
      .reverse();
    return {
      hitRatePct: metrics.hitRatePct,
      won: metrics.won,
      lost: metrics.lost,
      form: settled.map((r) => r.status === "won"),
    };
  },
  ["v3-high-potential"],
  { revalidate: 300 }
);

/** The whole archive's settled rate — the rail's real baseline (group 5). */
const loadOverallRecord = unstable_cache(
  async () => {
    const { metrics } = await queryArchive("en", {}, { dateLimit: 21 });
    return { hitRatePct: metrics.hitRatePct };
  },
  ["v3-high-potential-overall"],
  { revalidate: 300 }
);

export async function buildHighPotentialToday(
  lists: DailyMatchLists
): Promise<HighPotentialMarket[]> {
  const [overall, rows] = await Promise.all([
    loadOverallRecord(),
    Promise.all(
      ARCHIVE_MARKETS.map(async (marketKey) => {
        const record = await loadMarketRecord(marketKey);
        return {
          marketKey,
          marketLabel: marketForListKind(marketKey).label,
          hitRatePct: record.hitRatePct,
          won: record.won,
          lost: record.lost,
          todayCount: new Set((lists[marketKey] as FootyMatchRow[]).map((r) => r.matchId)).size,
          form: record.form,
          smallSample: record.won + record.lost > 0 && record.won + record.lost < 5,
        };
      })
    ),
  ]);
  /*
   * GROUP 5 — the same weighting as the table: |rate−baseline|×n/(n+5),
   * where the baseline is the archive's OWN overall settled rate (does the
   * market beat the book's record?) and n is the market's settled count.
   * Small-sample markets sort behind every n≥5 market, whatever their raw
   * pct says.
   */
  const baseline = overall.hitRatePct;
  const score = (row: (typeof rows)[number]) => {
    const n = row.won + row.lost;
    if (row.hitRatePct === null || baseline === null || n === 0) return 0;
    return (Math.abs(row.hitRatePct - baseline) / 100) * (n / (n + 5));
  };
  return rows
    .filter((row) => row.hitRatePct !== null && row.won + row.lost > 0)
    .sort(
      (a, b) =>
        Number(a.smallSample) - Number(b.smallSample) ||
        score(b) - score(a) ||
        (b.hitRatePct ?? 0) - (a.hitRatePct ?? 0)
    );
}
