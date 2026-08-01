import { listCompetitions } from "@/lib/competitions/registry";
import { listIndexableCountryCodes } from "@/lib/countries/landing";
import { countryName } from "@/lib/geoNames";
import { listMarkets } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import type { CrawlEntityType, PublicRoute } from "./types";

const HUBS: Array<{
  path: string;
  title: string;
  entityType: CrawlEntityType;
  indexable?: boolean;
}> = [
  { path: "/competitions", title: "Competitions", entityType: "competition" },
  { path: "/seasons", title: "Seasons", entityType: "season" },
  { path: "/teams", title: "Teams", entityType: "team" },
  { path: "/markets", title: "Markets", entityType: "market" },
  { path: "/operators", title: "Operators", entityType: "operator" },
  { path: "/countries", title: "Countries", entityType: "country" },
  {
    path: "/combo",
    title: "Evidence Combo (redirects to Acca Builder)",
    entityType: "none",
    indexable: false,
  },
  { path: "/acca", title: "Acca Studio", entityType: "none", indexable: false },
  {
    path: "/acca/builder",
    title: "Evidence-Based Acca Builder",
    entityType: "none",
    indexable: false,
  },
  { path: "/archive", title: "Prediction archive", entityType: "none", indexable: true },
  { path: "/methodology", title: "Methodology", entityType: "none", indexable: true },
];

/** Registry of every public crawl route in scope (no developer/API/404). */
export function buildPublicRouteInventory(): PublicRoute[] {
  const routes: PublicRoute[] = [];

  routes.push({
    key: "home",
    kind: "home",
    entityType: "none",
    entityId: "",
    path: "/",
    indexable: true,
    title: "Home",
  });

  for (const hub of HUBS) {
    routes.push({
      key: `hub:${hub.path}`,
      kind: "hub",
      entityType: hub.entityType,
      entityId: "",
      path: hub.path,
      indexable: hub.indexable !== false,
      title: hub.title,
    });
  }

  routes.push({
    key: "search",
    kind: "search",
    entityType: "none",
    entityId: "",
    path: "/search",
    indexable: false,
    title: "Search",
  });

  for (const competition of listCompetitions()) {
    routes.push({
      key: `competition:${competition.slug}`,
      kind: "entity",
      entityType: "competition",
      entityId: competition.slug,
      path: `/competitions/${competition.slug}`,
      indexable: true,
      title: competition.name,
    });
  }

  for (const season of listSeasons()) {
    routes.push({
      key: `season:${season.id}`,
      kind: "entity",
      entityType: "season",
      entityId: season.id,
      path: `/competitions/${season.competitionSlug}/seasons/${season.slug}`,
      indexable: true,
      title: season.displayName,
    });
  }

  for (const team of listTeams()) {
    routes.push({
      key: `team:${team.slug}`,
      kind: "entity",
      entityType: "team",
      entityId: team.slug,
      path: `/teams/${team.slug}`,
      indexable: true,
      title: team.name,
    });
  }

  for (const market of listMarkets()) {
    routes.push({
      key: `market:${market.slug}`,
      kind: "entity",
      entityType: "market",
      entityId: market.slug,
      path: `/markets/${market.slug}`,
      indexable: true,
      title: market.name,
    });
  }

  for (const operator of listOperators()) {
    routes.push({
      key: `operator:${operator.slug}`,
      kind: "entity",
      entityType: "operator",
      entityId: operator.slug,
      path: `/operators/${operator.slug}`,
      indexable: true,
      title: operator.name,
    });
  }

  for (const code of listIndexableCountryCodes()) {
    routes.push({
      key: `country:${code.toLowerCase()}`,
      kind: "entity",
      entityType: "country",
      entityId: code.toLowerCase(),
      path: `/countries/${code.toLowerCase()}`,
      indexable: true,
      title: countryName(code),
    });
  }

  return routes;
}

export function inventoryEntityRoutes(
  routes: readonly PublicRoute[] = buildPublicRouteInventory()
): PublicRoute[] {
  return routes.filter((route) => route.kind === "entity");
}

export function routeByKey(
  key: string,
  routes: readonly PublicRoute[] = buildPublicRouteInventory()
): PublicRoute | undefined {
  return routes.find((route) => route.key === key);
}

/** Paths that must never appear in the public inventory. */
export const EXCLUDED_PATH_PREFIXES = [
  "/developer",
  "/api",
  "/admin",
  "/not-available",
  "/go",
] as const;
