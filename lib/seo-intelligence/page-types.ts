import type { SeoPageType } from "./contracts";

export type PageTypeContract = {
  pageType: SeoPageType;
  label: string;
  routePatterns: string[];
  defaultIndexability:
    | "INDEX"
    | "NOINDEX"
    | "REDIRECT"
    | "EXCLUDED"
    | "CONDITIONAL"
    | "ERROR";
  sitemapEligible: boolean;
  schemaTypes: string[];
  minimumContent: string[];
  staleBehavior: string;
  expectedLinkSources: string[];
  metadataSource: string;
  notes: string[];
};

/** Explicit quality contracts per page type — documented source of truth. */
export const PAGE_TYPE_CONTRACTS: readonly PageTypeContract[] = [
  {
    pageType: "home",
    label: "Homepage",
    routePatterns: ["/{locale}"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["WebSite", "Organization", "WebPage"],
    minimumContent: ["hero", "qualified fixtures or empty-state honesty", "unique meta"],
    staleBehavior: "Daily refresh; filters never enter canonical",
    expectedLinkSources: ["nav", "footer", "sitemaps", "entity hubs"],
    metadataSource: "dictionaries + pageMetadata",
    notes: ["Query filters must not create indexable variants"],
  },
  {
    pageType: "search",
    label: "Search",
    routePatterns: ["/{locale}/search"],
    defaultIndexability: "NOINDEX",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["utility results only"],
    staleBehavior: "Always noindex",
    expectedLinkSources: ["header search"],
    metadataSource: "inline pageMetadata index:false",
    notes: ["Never sitemap; SEARCH_RESULT_PAGE"],
  },
  {
    pageType: "fixture",
    label: "Match / fixture",
    routePatterns: ["/{locale}/fixtures/{matchId}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: false,
    schemaTypes: ["SportsEvent", "BreadcrumbList"],
    minimumContent: [
      "verified fixture identity",
      "competition + teams",
      "kickoff",
      "published prediction or settled archive value",
      "unique title/H1",
    ],
    staleBehavior:
      "Settled with archive value may remain indexable; empty/invalid shells noindex; cancelled without value noindex",
    expectedLinkSources: ["explorer", "archive", "competition", "team", "related"],
    metadataSource: "loadMatchPage.server + pageMetadata",
    notes: ["Not currently in sitemap; discovery via internal links"],
  },
  {
    pageType: "competition",
    label: "Competition detail",
    routePatterns: ["/{locale}/competitions/{slug}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: ["CollectionPage", "SportsOrganization", "BreadcrumbList", "ItemList"],
    minimumContent: ["verified competition", "coverage or unique stats", "internal links"],
    staleBehavior: "Registry entity; thin shells → REVIEW_REQUIRED / noindex preference",
    expectedLinkSources: ["hub", "graph", "markets", "teams", "home"],
    metadataSource: "registry + pageMetadata",
    notes: [],
  },
  {
    pageType: "competition_hub",
    label: "Competitions hub",
    routePatterns: ["/{locale}/competitions"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["ItemList", "BreadcrumbList"],
    minimumContent: ["list of competitions"],
    staleBehavior: "Evergreen hub",
    expectedLinkSources: ["nav", "footer"],
    metadataSource: "hardcoded EN pageMetadata",
    notes: [],
  },
  {
    pageType: "team",
    label: "Team detail",
    routePatterns: ["/{locale}/teams/{slug}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: ["WebPage", "SportsTeam", "BreadcrumbList", "ItemList"],
    minimumContent: ["verified team", "fixture/history signals", "not name-only"],
    staleBehavior: "Thin team shells flagged; no fabricated bios",
    expectedLinkSources: ["hub", "competition", "fixture", "graph"],
    metadataSource: "lib/teams/seo.ts",
    notes: [],
  },
  {
    pageType: "team_hub",
    label: "Teams hub",
    routePatterns: ["/{locale}/teams"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["ItemList"],
    minimumContent: ["team list"],
    staleBehavior: "Evergreen",
    expectedLinkSources: ["nav"],
    metadataSource: "pageMetadata",
    notes: [],
  },
  {
    pageType: "market",
    label: "Market detail",
    routePatterns: ["/{locale}/markets/{slug}"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["WebPage", "BreadcrumbList", "FAQPage", "ItemList"],
    minimumContent: ["registry SEO templates", "related fixtures"],
    staleBehavior: "Evergreen market definitions",
    expectedLinkSources: ["hub", "competition", "home"],
    metadataSource: "markets registry seo templates",
    notes: [],
  },
  {
    pageType: "market_hub",
    label: "Markets hub",
    routePatterns: ["/{locale}/markets"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["ItemList"],
    minimumContent: ["market list"],
    staleBehavior: "Evergreen",
    expectedLinkSources: ["nav"],
    metadataSource: "pageMetadata",
    notes: [],
  },
  {
    pageType: "season",
    label: "Season",
    routePatterns: ["/{locale}/competitions/{slug}/seasons/{season}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: ["CollectionPage", "BreadcrumbList"],
    minimumContent: ["season identity", "related competition"],
    staleBehavior: "Past seasons remain if contentful",
    expectedLinkSources: ["competition", "seasons hub"],
    metadataSource: "lib/seasons/seo.ts",
    notes: [],
  },
  {
    pageType: "season_hub",
    label: "Seasons hub",
    routePatterns: ["/{locale}/seasons"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["ItemList"],
    minimumContent: ["season list"],
    staleBehavior: "Evergreen",
    expectedLinkSources: ["nav"],
    metadataSource: "pageMetadata",
    notes: [],
  },
  {
    pageType: "archive_hub",
    label: "Archive hub",
    routePatterns: ["/{locale}/archive"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: ["CollectionPage", "BreadcrumbList"],
    minimumContent: ["settledPredictions >= 3 for index"],
    staleBehavior: "Filters/pagination canonicalize to hub",
    expectedLinkSources: ["footer", "methodology", "home trust"],
    metadataSource: "archive page + pageMetadata",
    notes: ["Transparency dashboard is a component, not a route"],
  },
  {
    pageType: "archive_day",
    label: "Archive date",
    routePatterns: ["/{locale}/archive/{date}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: false,
    schemaTypes: ["CollectionPage", "BreadcrumbList", "ItemList", "SportsEvent"],
    minimumContent: ["settled >= 1 OR total >= 3", "factual settlement rows"],
    staleBehavior: "Empty dates should noindex; useful settled days endure",
    expectedLinkSources: ["archive hub", "pagination"],
    metadataSource: "archive/[date] pageMetadata",
    notes: ["Not currently sitemapped"],
  },
  {
    pageType: "methodology",
    label: "Methodology",
    routePatterns: ["/{locale}/methodology"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["WebPage", "BreadcrumbList"],
    minimumContent: ["substantial factual methodology content"],
    staleBehavior: "Stable canonical; version notes when available",
    expectedLinkSources: ["archive", "footer", "home"],
    metadataSource: "pageMetadata index:true",
    notes: [],
  },
  {
    pageType: "operator",
    label: "Operator",
    routePatterns: ["/{locale}/operators/{slug}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: ["WebPage", "Organization", "BreadcrumbList", "ItemList"],
    minimumContent: ["valid operator data", "geo/availability honesty", "not doorway-only"],
    staleBehavior: "Disabled operators should not stay aggressively indexed",
    expectedLinkSources: ["hub", "reviews", "fixture CTAs"],
    metadataSource: "pageMetadata",
    notes: [],
  },
  {
    pageType: "operator_hub",
    label: "Operators hub",
    routePatterns: ["/{locale}/operators"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["ItemList"],
    minimumContent: ["operator list"],
    staleBehavior: "Evergreen",
    expectedLinkSources: ["nav"],
    metadataSource: "pageMetadata",
    notes: [],
  },
  {
    pageType: "review",
    label: "Bookmaker review",
    routePatterns: ["/{locale}/reviews/{slug}"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["Review"],
    minimumContent: ["brand facts", "disclaimer", "no fabricated ratings"],
    staleBehavior: "Editorial freshness operator-owned",
    expectedLinkSources: ["operators", "best hubs"],
    metadataSource: "dictionaries + brand",
    notes: ["Review schema must not invent AggregateRating from missing data"],
  },
  {
    pageType: "country",
    label: "Country landing",
    routePatterns: ["/{locale}/countries/{code}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: ["WebPage", "BreadcrumbList"],
    minimumContent: ["profile", "competitions", "operators", "unique summary ≥80"],
    staleBehavior: "Doorway risk → noindex (lib/seo/indexability)",
    expectedLinkSources: ["countries hub", "availability"],
    metadataSource: "country landing builder",
    notes: ["Only indexable codes enter sitemap"],
  },
  {
    pageType: "country_hub",
    label: "Countries hub",
    routePatterns: ["/{locale}/countries"],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: ["ItemList"],
    minimumContent: ["country list"],
    staleBehavior: "Evergreen",
    expectedLinkSources: ["nav"],
    metadataSource: "pageMetadata",
    notes: [],
  },
  {
    pageType: "compare",
    label: "Compare",
    routePatterns: ["/{locale}/compare/{slug}"],
    defaultIndexability: "CONDITIONAL",
    sitemapEligible: true,
    schemaTypes: [],
    minimumContent: ["indexable slug allowlist only"],
    staleBehavior: "Non-allowlisted remain noindex",
    expectedLinkSources: ["reviews", "operators"],
    metadataSource: "compare page + isIndexableCompareSlug",
    notes: [],
  },
  {
    pageType: "acca_studio",
    label: "Acca Studio",
    routePatterns: ["/{locale}/acca"],
    defaultIndexability: "NOINDEX",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["private workspace"],
    staleBehavior: "Always noindex unless future product decision",
    expectedLinkSources: ["nav", "home Acca entry"],
    metadataSource: "pageMetadata index:false",
    notes: ["PRIVATE_WORKSPACE"],
  },
  {
    pageType: "acca_builder",
    label: "Acca Builder",
    routePatterns: ["/{locale}/acca/builder"],
    defaultIndexability: "NOINDEX",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["private workspace"],
    staleBehavior: "Always noindex",
    expectedLinkSources: ["studio", "home", "combo redirect"],
    metadataSource: "pageMetadata index:false",
    notes: ["PRIVATE_WORKSPACE"],
  },
  {
    pageType: "combo_redirect",
    label: "Combo redirect",
    routePatterns: ["/{locale}/combo"],
    defaultIndexability: "REDIRECT",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["server redirect to builder"],
    staleBehavior: "Must not appear in sitemap",
    expectedLinkSources: ["legacy bookmarks"],
    metadataSource: "index:false + redirect",
    notes: ["CANONICAL_REDIRECT"],
  },
  {
    pageType: "affiliate_hub",
    label: "Affiliate hubs",
    routePatterns: [
      "/{locale}/best-betting-sites",
      "/{locale}/best-crypto-betting-sites",
      "/{locale}/bonuses",
      "/{locale}/availability",
    ],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: [],
    minimumContent: ["dictionary content", "operator lists"],
    staleBehavior: "Evergreen marketing hubs",
    expectedLinkSources: ["nav", "footer"],
    metadataSource: "dictionaries",
    notes: [],
  },
  {
    pageType: "legal",
    label: "Legal / RG",
    routePatterns: [
      "/{locale}/terms",
      "/{locale}/privacy",
      "/{locale}/responsible-gambling",
    ],
    defaultIndexability: "INDEX",
    sitemapEligible: true,
    schemaTypes: [],
    minimumContent: ["legal copy"],
    staleBehavior: "Stable",
    expectedLinkSources: ["footer"],
    metadataSource: "dictionaries",
    notes: [],
  },
  {
    pageType: "admin",
    label: "Admin",
    routePatterns: ["/admin", "/admin/*"],
    defaultIndexability: "EXCLUDED",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["auth gated"],
    staleBehavior: "Always excluded + X-Robots-Tag",
    expectedLinkSources: ["none public"],
    metadataSource: "admin layout robots",
    notes: ["ADMIN_ROUTE"],
  },
  {
    pageType: "developer",
    label: "Developer diagnostics",
    routePatterns: ["/developer", "/developer/*"],
    defaultIndexability: "EXCLUDED",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["diagnostics"],
    staleBehavior: "Always noindex",
    expectedLinkSources: ["none public"],
    metadataSource: "page robots + middleware",
    notes: ["DEVELOPER_ROUTE"],
  },
  {
    pageType: "error",
    label: "Error / 404",
    routePatterns: ["/* (not-found)", "/not-available"],
    defaultIndexability: "ERROR",
    sitemapEligible: false,
    schemaTypes: [],
    minimumContent: ["recovery links"],
    staleBehavior: "HTTP 404/410; not-available explicit noindex",
    expectedLinkSources: ["none"],
    metadataSource: "not-available robots; 404 relies on status",
    notes: [],
  },
];

export function contractFor(pageType: SeoPageType): PageTypeContract | undefined {
  return PAGE_TYPE_CONTRACTS.find((c) => c.pageType === pageType);
}

export function classifyPath(path: string): SeoPageType {
  const p = path.split("?")[0] || "/";
  if (p === "/" || p === "") return "home";
  if (p === "/search" || p.startsWith("/search/")) return "search";
  if (p.startsWith("/fixtures/")) return "fixture";
  if (p === "/competitions") return "competition_hub";
  if (/^\/competitions\/[^/]+\/seasons\/[^/]+$/.test(p)) return "season";
  if (p.startsWith("/competitions/")) return "competition";
  if (p === "/teams") return "team_hub";
  if (p.startsWith("/teams/")) return "team";
  if (p === "/markets") return "market_hub";
  if (p.startsWith("/markets/")) return "market";
  if (p === "/seasons") return "season_hub";
  if (p === "/archive") return "archive_hub";
  if (/^\/archive\/\d{4}-\d{2}-\d{2}$/.test(p)) return "archive_day";
  if (p === "/methodology") return "methodology";
  if (p === "/operators") return "operator_hub";
  if (p.startsWith("/operators/")) return "operator";
  if (p.startsWith("/reviews/")) return "review";
  if (p === "/countries") return "country_hub";
  if (p.startsWith("/countries/")) return "country";
  if (p.startsWith("/compare/")) return "compare";
  if (p === "/acca/builder" || p.startsWith("/acca/builder/")) return "acca_builder";
  if (p === "/acca" || p.startsWith("/acca/")) return "acca_studio";
  if (p === "/combo" || p.startsWith("/combo/")) return "combo_redirect";
  if (
    p === "/best-betting-sites" ||
    p === "/best-crypto-betting-sites" ||
    p === "/bonuses" ||
    p === "/availability"
  ) {
    return "affiliate_hub";
  }
  if (p === "/terms" || p === "/privacy" || p === "/responsible-gambling") {
    return "legal";
  }
  if (p === "/admin" || p.startsWith("/admin/")) return "admin";
  if (p === "/developer" || p.startsWith("/developer/")) return "developer";
  if (p === "/not-available" || p.startsWith("/go/")) return "utility";
  if (p === "/today") return "utility";
  return "unknown";
}
