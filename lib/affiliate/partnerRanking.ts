import type { AffiliatePartner, ResolvedOperatorOffer } from "./operators";

export type PartnerMetricKey =
  | "verified_market"
  | "regional_availability"
  | "affiliate_configured"
  | "live_market_supported"
  | "crypto_support"
  | "mobile_app"
  | "cashback"
  | "priority_override"
  | "country_preference"
  | "device_support"
  | "ctr"
  | "registration_rate"
  | "ftd_rate"
  | "epc"
  | "conversion_rate"
  | (string & {});

export type PartnerMetricValues = Readonly<Partial<Record<PartnerMetricKey, number | boolean>>>;

export type PartnerScoreComponent = {
  key: PartnerMetricKey;
  points: number;
  applied: boolean;
};

export type PartnerScore = {
  total: number;
  components: readonly PartnerScoreComponent[];
};

export type PartnerRankResult = {
  offer: ResolvedOperatorOffer;
  score: PartnerScore;
  rank: number;
};

export type PartnerRankingCandidate = {
  partner: AffiliatePartner;
  offer: ResolvedOperatorOffer;
  regionallyAvailable: boolean;
  metrics?: PartnerMetricValues;
};

export type PartnerScoreRule = {
  key: PartnerMetricKey;
  evaluate(candidate: PartnerRankingCandidate): number;
};

function hasConfiguredHighlight(partner: AffiliatePartner, pattern: RegExp): boolean {
  return partner.highlights.some((highlight) => pattern.test(highlight));
}

const defaultRules: readonly PartnerScoreRule[] = [
  { key: "verified_market", evaluate: ({ offer }) => offer.oddsVerified ? 30 : 0 },
  { key: "regional_availability", evaluate: ({ regionallyAvailable }) => regionallyAvailable ? 25 : 0 },
  { key: "affiliate_configured", evaluate: ({ partner }) => partner.isConfigured ? 20 : 0 },
  {
    key: "live_market_supported",
    evaluate: ({ partner }) => hasConfiguredHighlight(partner, /\blive betting\b|\bin-play betting\b/i) ? 10 : 0,
  },
  { key: "crypto_support", evaluate: ({ partner }) => partner.crypto ? 5 : 0 },
  {
    key: "mobile_app",
    evaluate: ({ partner }) => hasConfiguredHighlight(partner, /\bmobile app\b/i) ? 5 : 0,
  },
  {
    key: "cashback",
    evaluate: ({ partner }) => hasConfiguredHighlight(partner, /\bcashback\b|\bcash back\b/i) ? 3 : 0,
  },
  {
    key: "priority_override",
    evaluate: ({ partner }) => Number.isFinite(partner.priorityOverride) ? partner.priorityOverride! : 0,
  },
  {
    key: "country_preference",
    evaluate: ({ metrics }) =>
      typeof metrics?.country_preference === "number" ? metrics.country_preference : 0,
  },
  {
    key: "device_support",
    evaluate: ({ metrics }) => (metrics?.device_support ? 5 : 0),
  },
  {
    key: "ctr",
    evaluate: ({ metrics }) => (typeof metrics?.ctr === "number" ? metrics.ctr : 0),
  },
  {
    key: "epc",
    evaluate: ({ metrics }) => (typeof metrics?.epc === "number" ? metrics.epc : 0),
  },
  {
    key: "ftd_rate",
    evaluate: ({ metrics }) => (typeof metrics?.ftd_rate === "number" ? metrics.ftd_rate : 0),
  },
  {
    key: "conversion_rate",
    evaluate: ({ metrics }) =>
      typeof metrics?.conversion_rate === "number" ? metrics.conversion_rate : 0,
  },
];

export class PartnerRankingService {
  constructor(private readonly rules: readonly PartnerScoreRule[] = defaultRules) {}

  score(candidate: PartnerRankingCandidate): PartnerScore {
    const components = this.rules.map((rule) => {
      const points = rule.evaluate(candidate);
      return { key: rule.key, points, applied: points !== 0 };
    });
    return {
      total: components.reduce((total, component) => total + component.points, 0),
      components,
    };
  }

  rank(candidates: readonly PartnerRankingCandidate[]): PartnerRankResult[] {
    return candidates
      .map((candidate) => ({ offer: candidate.offer, score: this.score(candidate) }))
      .sort((left, right) =>
        right.score.total - left.score.total ||
        left.offer.displayName.localeCompare(right.offer.displayName)
      )
      .map((result, index) => ({ ...result, rank: index + 1 }));
  }
}
