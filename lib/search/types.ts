/** Public searchable entity types (fixture reserved until a fixture registry exists). */
export type SearchEntityType =
  | "competition"
  | "season"
  | "team"
  | "fixture"
  | "market"
  | "operator"
  | "country"
  | "player"
  | "venue"
  | "referee";

/** Types currently indexed from registries + short-horizon fixtures + country hubs. */
export const INDEXED_ENTITY_TYPES = [
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
  "country",
] as const satisfies readonly SearchEntityType[];

export type IndexedEntityType = (typeof INDEXED_ENTITY_TYPES)[number];

/** Display / filter group order. */
export const SEARCH_GROUP_ORDER = [
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
  "country",
] as const satisfies readonly SearchEntityType[];

export type SearchGroupKey = (typeof SEARCH_GROUP_ORDER)[number];

export const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  competition: "Competitions",
  season: "Seasons",
  team: "Teams",
  fixture: "Fixtures",
  market: "Markets",
  operator: "Operators",
  country: "Countries",
};

export type MatchTier =
  | "exact_slug"
  | "exact_title"
  | "exact_alias"
  | "prefix"
  | "contains"
  | "fuzzy";

export const MATCH_TIER_RANK: Record<MatchTier, number> = {
  exact_slug: 0,
  exact_title: 1,
  exact_alias: 2,
  prefix: 3,
  contains: 4,
  fuzzy: 5,
};

/** Internal index document — never returned as-is from the public API. */
export type SearchDocument = {
  id: string;
  entityType: IndexedEntityType;
  slug: string;
  title: string;
  aliases: string[];
  locale: string;
  keywords: string[];
  popularityWeight: number;
  graphScore: number;
  integrityScore: number;
  searchable: boolean;
  active: boolean;
  /** Season URL segment under competition (when entityType === season). */
  competitionSlug?: string;
  urlSlug?: string;
  pathTemplate: string;
  normalizedSlug: string;
  normalizedTitle: string;
  normalizedAliases: string[];
  normalizedKeywords: string[];
};

export type SearchResult = {
  entityType: SearchEntityType;
  slug: string;
  title: string;
  href: string;
  group: SearchGroupKey;
  /** Present for seasons so clients can disambiguate URL segments. */
  competitionSlug?: string;
};

export type SearchGroups = Partial<Record<SearchGroupKey, SearchResult[]>>;

export type SearchOptions = {
  locale?: string;
  country?: string | null;
  countrySource?: string | null;
  entityTypes?: readonly SearchEntityType[];
  limit?: number;
  limitPerGroup?: number;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  groups: SearchGroups;
  meta: {
    count: number;
    tookMs: number;
    emptyReason?: "no_query" | "no_results" | "filtered_away" | "unsupported_locale";
  };
};

export type SearchIndexSnapshot = {
  documents: SearchDocument[];
  builtAt: number;
  counts: Record<IndexedEntityType, number>;
  size: number;
};

export type SearchDiagnostics = {
  indexSize: number;
  entityCounts: Record<IndexedEntityType, number>;
  averageLookupMs: number;
  lookupSamples: number;
  topQueries: Array<{ query: string; count: number }>;
  zeroResultQueries: Array<{ query: string; count: number }>;
  mostClickedEntities: Array<{
    entityType: string;
    entitySlug: string;
    count: number;
  }>;
  cacheStatus: {
    warm: boolean;
    builtAt: number | null;
    ttlMs: number;
    ageMs: number | null;
  };
  discovery: {
    mostViewedTeams: Array<{ slug: string; count: number }>;
    mostViewedCompetitions: Array<{ slug: string; count: number }>;
    mostViewedMarkets: Array<{ slug: string; count: number }>;
    mostViewedOperators: Array<{ slug: string; count: number }>;
    mostViewedSeasons: Array<{ slug: string; count: number }>;
    mostClickedRelationships: Array<{ key: string; count: number }>;
  };
};
