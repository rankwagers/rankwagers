export type OperatorVerificationStatus = "verified" | "unverified";

export type OperatorMarketKey = "fh" | "over15" | "over25" | "sh";

/** First-class operator entity — page and linking source of truth. */
export type Operator = {
  slug: string;
  name: string;
  logo?: string;
  description: string;
  supportedCountries: readonly string[];
  supportedMarkets: readonly OperatorMarketKey[];
  website: string | null;
  affiliateEnabled: boolean;
  verificationStatus: OperatorVerificationStatus;
  foundedYear: number | null;
  headquarters: string | null;
  highlights: readonly string[];
  licenses: readonly string[];
  /** API-Football bookmaker ids when verified. */
  apiFootballBookmakerIds: readonly number[];
};

export type OperatorMarketMeta = {
  key: OperatorMarketKey;
  label: string;
  line: string;
};

export const OPERATOR_MARKET_META: Record<OperatorMarketKey, OperatorMarketMeta> = {
  fh: { key: "fh", label: "1st half goal", line: "0.5" },
  over15: { key: "over15", label: "Over 1.5 goals", line: "1.5" },
  over25: { key: "over25", label: "Over 2.5 goals", line: "2.5" },
  sh: { key: "sh", label: "2nd half goal", line: "0.5" },
};

export type OperatorCountryAvailability = {
  visitorCountry: string;
  available: boolean;
  label: "Available in your country" | "Not currently available" | "Availability not restricted";
};

export type OperatorOddsPerformance = {
  sampleSize: number;
  averageOdds: number | null;
  highestOdds: number | null;
  lowestOdds: number | null;
  marketCoverage: number;
  marketsObserved: string[];
  movementCount: number;
  steamCount: number;
  clvAveragePercent: number | null;
  recentFixtureIds: number[];
};
