import type { MatchListKind } from "@/lib/footystats/types";
import type { MarketDefinition } from "./types";

const MARKETS: MarketDefinition[] = [
  {
    slug: "over-2-5",
    name: "Over 2.5 Goals",
    shortDescription: "Whether a match finishes with three or more total goals.",
    longDescription:
      "Over 2.5 is a totals market settled on the final match score. RankWagers surfaces fixtures that already meet published qualification thresholds and pairs them with observed operator odds — without recommending bets.",
    howItWorks: [
      "The market wins if the match has at least three goals in regular time (unless competition rules state otherwise).",
      "Research views show historical team/league goal environment metrics where FootyStats coverage exists.",
      "Odds intelligence uses stored bookmaker observations only; missing history stays empty.",
    ],
    category: "totals",
    listKind: "over25",
    operatorMarketKey: "over25",
    evidenceMetrics: [
      "goal_frequency",
      "xg_environment",
      "league_baseline",
      "home_away_split",
      "sample_quality",
    ],
    relatedMarketSlugs: ["over-1-5", "btts", "first-half-goals"],
    relatedLeagues: ["Premier League", "Bundesliga", "Eredivisie"],
    seo: {
      titleTemplate: "Over 2.5 Goals Market Intelligence",
      description:
        "Evidence-first Over 2.5 goals market reference: how settlement works, qualified fixtures, operator coverage, and observed odds history on RankWagers.",
      faqs: [
        {
          question: "What does Over 2.5 goals mean?",
          answer:
            "The market is settled on whether the match has three or more total goals. RankWagers explains the market and shows research context; it does not provide tips.",
        },
        {
          question: "Does RankWagers predict Over 2.5 outcomes?",
          answer:
            "No. Pages show qualification thresholds, factual evidence metrics, and observed odds — not betting recommendations.",
        },
      ],
    },
  },
  {
    slug: "over-1-5",
    name: "Over 1.5 Goals",
    shortDescription: "Whether a match finishes with two or more total goals.",
    longDescription:
      "Over 1.5 is a lower totals line than Over 2.5. RankWagers uses it as a research market when fixtures clear the published Over 1.5 qualification threshold.",
    howItWorks: [
      "Settlement depends on two or more goals in the match.",
      "Evidence focuses on goal frequency and venue splits when samples are adequate.",
      "Operator pages and odds history reconnect here when bookmakers quote the line.",
    ],
    category: "totals",
    listKind: "over15",
    operatorMarketKey: "over15",
    evidenceMetrics: [
      "goal_frequency",
      "league_baseline",
      "home_away_split",
      "sample_quality",
    ],
    relatedMarketSlugs: ["over-2-5", "btts", "first-half-goals"],
    relatedLeagues: ["Premier League", "Serie A", "Ligue 1"],
    seo: {
      titleTemplate: "Over 1.5 Goals Market Intelligence",
      description:
        "Research reference for Over 1.5 goals: market explanation, qualified fixtures, operators, and observed odds on RankWagers.",
      faqs: [
        {
          question: "How is Over 1.5 different from Over 2.5?",
          answer:
            "Over 1.5 needs two or more goals; Over 2.5 needs three or more. Both are totals markets with different thresholds.",
        },
      ],
    },
  },
  {
    slug: "first-half-goals",
    name: "First Half Goals (Over 0.5)",
    shortDescription: "Whether at least one goal is scored before half-time.",
    longDescription:
      "First-half Over 0.5 is a timing market. RankWagers tracks qualified fixtures against a published first-half threshold and links evidence from half-time goal rates.",
    howItWorks: [
      "The market is settled on first-half goals only.",
      "Evidence uses first-half scoring rates when FootyStats team samples exist.",
      "Odds snapshots are limited to bookmakers that quote the mapped first-half line.",
    ],
    category: "half-time",
    listKind: "fh",
    operatorMarketKey: "fh",
    evidenceMetrics: [
      "goal_frequency",
      "home_away_split",
      "league_baseline",
      "sample_quality",
    ],
    relatedMarketSlugs: ["second-half-goals", "over-1-5", "over-2-5"],
    relatedLeagues: ["Premier League", "La Liga", "Bundesliga"],
    seo: {
      titleTemplate: "First Half Goals Market Intelligence",
      description:
        "First-half Over 0.5 market reference with research fixtures, evidence indicators, and operator odds coverage.",
      faqs: [
        {
          question: "Does a second-half goal settle First Half Over 0.5?",
          answer:
            "No. Only goals scored in the first half count for this market.",
        },
      ],
    },
  },
  {
    slug: "second-half-goals",
    name: "Second Half Goals (Over 0.5)",
    shortDescription: "Whether at least one goal is scored after half-time.",
    longDescription:
      "Second-half Over 0.5 isolates scoring after the break. RankWagers includes it in the research queue when fixtures meet the published second-half threshold.",
    howItWorks: [
      "Settlement uses second-half goals only.",
      "Evidence emphasises second-half scoring rates and sample quality.",
      "Related totals markets help compare full-match versus half-specific environments.",
    ],
    category: "half-time",
    listKind: "sh",
    operatorMarketKey: "sh",
    evidenceMetrics: [
      "goal_frequency",
      "home_away_split",
      "sample_quality",
    ],
    relatedMarketSlugs: ["first-half-goals", "over-1-5", "over-2-5"],
    relatedLeagues: ["Premier League", "Championship", "MLS"],
    seo: {
      titleTemplate: "Second Half Goals Market Intelligence",
      description:
        "Second-half Over 0.5 market intelligence: explanation, qualified fixtures, and observed operator coverage.",
      faqs: [],
    },
  },
  {
    slug: "btts",
    name: "Both Teams To Score (BTTS)",
    shortDescription: "Whether both teams score at least once in the match.",
    longDescription:
      "BTTS is an educational market page on RankWagers. Fixture qualification lists do not currently treat BTTS as a primary research queue, so upcoming fixtures stay empty until that coverage exists.",
    howItWorks: [
      "The market wins if each team scores at least one goal.",
      "Evidence indicators describe the metrics used elsewhere on the site (BTTS rates, sample quality).",
      "No tip or selection is generated from this page.",
    ],
    category: "both-teams",
    listKind: null,
    operatorMarketKey: null,
    evidenceMetrics: ["btts_rate", "goal_frequency", "sample_quality", "league_baseline"],
    relatedMarketSlugs: ["over-2-5", "over-1-5", "draw-no-bet"],
    relatedLeagues: ["Premier League", "Bundesliga", "Serie A"],
    seo: {
      titleTemplate: "BTTS Market Intelligence",
      description:
        "Both Teams To Score market explanation and evidence framework on RankWagers — educational reference without tips.",
      faqs: [
        {
          question: "Does RankWagers qualify BTTS fixtures today?",
          answer:
            "Not as a primary daily queue. This page explains the market and links related research markets that are currently tracked.",
        },
      ],
    },
  },
  {
    slug: "draw-no-bet",
    name: "Draw No Bet",
    shortDescription: "Back a team with stakes returned if the match draws.",
    longDescription:
      "Draw No Bet is documented for education and internal linking. RankWagers does not currently qualify DNB fixtures in the daily research queue.",
    howItWorks: [
      "Selecting a side wins if that team wins; a draw returns the stake.",
      "This page does not rank sides or recommend selections.",
      "Related result and totals markets provide adjacent research context.",
    ],
    category: "result",
    listKind: null,
    operatorMarketKey: null,
    evidenceMetrics: ["league_baseline", "home_away_split", "sample_quality"],
    relatedMarketSlugs: ["asian-handicap", "btts", "over-2-5"],
    relatedLeagues: ["Premier League", "La Liga", "Ligue 1"],
    seo: {
      titleTemplate: "Draw No Bet Market Intelligence",
      description:
        "Draw No Bet explained as an educational market reference on RankWagers, with links to related research markets.",
      faqs: [
        {
          question: "Is Draw No Bet a tip?",
          answer:
            "No. RankWagers documents how the market settles and connects related research entities only.",
        },
      ],
    },
  },
  {
    slug: "asian-handicap",
    name: "Asian Handicap",
    shortDescription: "Handicap markets that remove or split the draw using goal lines.",
    longDescription:
      "Asian Handicap covers a family of lines. RankWagers provides an educational overview and links to tracked totals/half markets rather than quoting every handicap line.",
    howItWorks: [
      "A handicap adjusts the final score before settlement.",
      "Quarter lines can split stakes across two outcomes.",
      "This page does not invent line sheets; odds panels appear only when observed history exists for mapped markets.",
    ],
    category: "handicap",
    listKind: null,
    operatorMarketKey: null,
    evidenceMetrics: ["goal_frequency", "xg_environment", "sample_quality"],
    relatedMarketSlugs: ["draw-no-bet", "over-2-5", "over-1-5"],
    relatedLeagues: ["Premier League", "Champions League", "Europa League"],
    seo: {
      titleTemplate: "Asian Handicap Market Intelligence",
      description:
        "Educational Asian Handicap reference on RankWagers with related markets, operators, and evidence concepts.",
      faqs: [],
    },
  },
];

const bySlug = new Map(MARKETS.map((market) => [market.slug, market]));

export function listMarkets(): MarketDefinition[] {
  return [...MARKETS];
}

export function getMarket(slug: string): MarketDefinition | undefined {
  return bySlug.get(slug);
}

export function marketSlugs(): string[] {
  return MARKETS.map((market) => market.slug);
}

export function getRelatedMarkets(slug: string): MarketDefinition[] {
  const market = getMarket(slug);
  if (!market) return [];
  return market.relatedMarketSlugs
    .map((related) => getMarket(related))
    .filter((related): related is MarketDefinition => Boolean(related));
}

export function marketSlugForListKind(kind: MatchListKind): string | null {
  const match = MARKETS.find((market) => market.listKind === kind);
  return match?.slug ?? null;
}
