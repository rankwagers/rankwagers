import { recommendForEntity } from "@/lib/discovery/engine";
import type { Locale } from "@/lib/i18n";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { buildEntityNavigation } from "@/lib/knowledge-graph/navigation";
import { buildSearchIndex } from "@/lib/search/indexer";
import {
  buildPublicRouteInventory,
  inventoryEntityRoutes,
} from "./inventory";
import type {
  CrawlEntityType,
  LinkCandidate,
  LinkEdge,
  LinkSurface,
  PublicRoute,
  RouteLinkStats,
} from "./types";

const DEFAULT_LOCALE: Locale = "en";
const MAX_SURFACE_LINKS = 12;

function hubKeyFor(entityType: CrawlEntityType): string | null {
  if (entityType === "none") return null;
  const path =
    entityType === "competition"
      ? "/competitions"
      : entityType === "season"
        ? "/seasons"
        : entityType === "team"
          ? "/teams"
          : entityType === "market"
            ? "/markets"
            : "/operators";
  return `hub:${path}`;
}

function graphSlug(entityType: CrawlEntityType, entityId: string): string {
  if (entityType === "season") {
    // season graph ids use season.id; graph entity slug is typically the id
    return entityId;
  }
  return entityId;
}

/** Dedupe link candidates by href (first wins). */
export function dedupeByHref<T extends LinkCandidate>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const href = item.href.trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(item);
  }
  return out;
}

/** Cap repeated links; preserves order. */
export function limitRepeatedLinks<T extends LinkCandidate>(
  items: readonly T[],
  limit = MAX_SURFACE_LINKS
): T[] {
  return dedupeByHref(items).slice(0, Math.max(0, limit));
}

/**
 * Balance discovery / graph / breadcrumb / search surfaces.
 * Prefer unique hrefs across surfaces; keep surface order priority.
 */
export function balanceSurfaces(input: {
  breadcrumb?: readonly LinkCandidate[];
  graph?: readonly LinkCandidate[];
  discovery?: readonly LinkCandidate[];
  search?: readonly LinkCandidate[];
  entity?: readonly LinkCandidate[];
  limitPerSurface?: number;
}): LinkCandidate[] {
  const limit = input.limitPerSurface ?? MAX_SURFACE_LINKS;
  const order: Array<{ surface: LinkSurface; items: readonly LinkCandidate[] | undefined }> = [
    { surface: "breadcrumb", items: input.breadcrumb },
    { surface: "graph", items: input.graph },
    { surface: "discovery", items: input.discovery },
    { surface: "search", items: input.search },
    { surface: "entity", items: input.entity },
  ];
  const seen = new Set<string>();
  const out: LinkCandidate[] = [];
  for (const bucket of order) {
    if (!bucket.items?.length) continue;
    let kept = 0;
    for (const item of bucket.items) {
      const href = item.href.trim();
      if (!href || seen.has(href)) continue;
      seen.add(href);
      out.push({ ...item, surface: bucket.surface, href });
      kept += 1;
      if (kept >= limit) break;
    }
  }
  return out;
}

function pathToRouteKey(path: string, routes: readonly PublicRoute[]): string | null {
  const clean = path.replace(/^\/[a-z]{2}(?:-[a-z]+)?/i, "") || "/";
  const normalized = clean.startsWith("/") ? clean : `/${clean}`;
  const match = routes.find((route) => route.path === normalized);
  return match?.key ?? null;
}

function pushEdge(
  edges: LinkEdge[],
  from: string,
  to: string,
  surface: LinkSurface,
  href: string
): void {
  if (!from || !to || from === to) return;
  edges.push({ from, to, surface, href });
}

/**
 * Synthetic internal link graph — no HTTP crawl.
 * Sources: hubs → entities, breadcrumbs, knowledge graph neighbors,
 * discovery related panels, search index documents.
 */
export function buildInternalLinkGraph(
  routes: readonly PublicRoute[] = buildPublicRouteInventory(),
  locale: Locale = DEFAULT_LOCALE
): LinkEdge[] {
  const edges: LinkEdge[] = [];
  const entities = inventoryEntityRoutes(routes);
  const routeKeys = new Set(routes.map((r) => r.key));

  // Hub → every entity of that type
  for (const entity of entities) {
    const hub = hubKeyFor(entity.entityType);
    if (hub && routeKeys.has(hub)) {
      pushEdge(edges, hub, entity.key, "hub", `/${locale}${entity.path}`);
    }
    // Home → hubs already; home → entity via search index below
    pushEdge(edges, "home", entity.key, "hub", `/${locale}${entity.path}`);
  }

  // Home ↔ Evidence Combo Studio hub (visible nav + homepage launcher)
  if (routeKeys.has("hub:/combo")) {
    pushEdge(edges, "home", "hub:/combo", "hub", `/${locale}/combo`);
    pushEdge(edges, "hub:/combo", "home", "breadcrumb", `/${locale}`);
    pushEdge(edges, "hub:/markets", "hub:/combo", "hub", `/${locale}/combo`);
    for (const entity of entities.filter((e) => e.entityType === "market")) {
      pushEdge(edges, entity.key, "hub:/combo", "entity", `/${locale}/combo`);
    }
  }

  // Entity → hub (outbound)
  for (const entity of entities) {
    const hub = hubKeyFor(entity.entityType);
    if (hub) {
      const hubRoute = routes.find((r) => r.key === hub);
      if (hubRoute) {
        pushEdge(edges, entity.key, hub, "breadcrumb", `/${locale}${hubRoute.path}`);
      }
    }
  }

  // Breadcrumbs + graph sections
  for (const entity of entities) {
    const slug = graphSlug(entity.entityType, entity.entityId);
    const nav = buildEntityNavigation(
      entity.entityType as "competition" | "season" | "team" | "market" | "operator",
      slug,
      locale
    );
    if (!nav) continue;

    for (const crumb of nav.breadcrumbs) {
      const to = pathToRouteKey(crumb.href, routes);
      if (to) pushEdge(edges, entity.key, to, "breadcrumb", crumb.href);
    }

    for (const section of nav.sections) {
      for (const item of section.items) {
        const to = pathToRouteKey(item.href, routes);
        if (to) pushEdge(edges, entity.key, to, "graph", item.href);
      }
    }
  }

  // Discovery related links (integrity-gated engine)
  for (const entity of entities) {
    if (
      entity.entityType !== "competition" &&
      entity.entityType !== "season" &&
      entity.entityType !== "team" &&
      entity.entityType !== "market" &&
      entity.entityType !== "operator"
    ) {
      continue;
    }
    try {
      const bundle = recommendForEntity(
        { entityType: entity.entityType, slug: graphSlug(entity.entityType, entity.entityId) },
        { locale, limitPerPanel: 4, depth: 2 }
      );
      for (const section of bundle.related) {
        for (const item of section.items) {
          const to = pathToRouteKey(item.href, routes);
          if (to) pushEdge(edges, entity.key, to, "discovery", item.href);
        }
      }
    } catch {
      // discovery may skip unknown seeds
    }
  }

  // Search index → entity documents (search surface inbound)
  try {
    const index = buildSearchIndex();
    for (const doc of index.documents) {
      const targetKey = `${doc.entityType}:${doc.slug}`;
      if (!routeKeys.has(targetKey)) continue;
      pushEdge(
        edges,
        "search",
        targetKey,
        "search",
        `/${locale}${doc.pathTemplate}`
      );
    }
  } catch {
    // search index optional for link graph
  }

  // Graph neighbor reciprocal inbound
  const graph = getKnowledgeGraph();
  for (const entity of entities) {
    const id = `${entity.entityType}:${graphSlug(entity.entityType, entity.entityId)}`;
    for (const row of graph.neighbors(id)) {
      const nType = row.entity.type;
      if (
        nType !== "competition" &&
        nType !== "season" &&
        nType !== "team" &&
        nType !== "market" &&
        nType !== "operator"
      ) {
        continue;
      }
      const toKey = `${nType}:${row.entity.slug}`;
      if (routeKeys.has(toKey)) {
        pushEdge(edges, toKey, entity.key, "entity", `/${locale}${entity.path}`);
      }
    }
  }

  return edges;
}

export function computeLinkStats(
  routes: readonly PublicRoute[],
  edges: readonly LinkEdge[]
): RouteLinkStats[] {
  const map = new Map<string, RouteLinkStats>();
  for (const route of routes) {
    map.set(route.key, {
      key: route.key,
      inbound: 0,
      outbound: 0,
      surfaces: {},
    });
  }
  for (const edge of edges) {
    const from = map.get(edge.from);
    const to = map.get(edge.to);
    if (from) {
      from.outbound += 1;
      from.surfaces[edge.surface] = (from.surfaces[edge.surface] ?? 0) + 1;
    }
    if (to) {
      to.inbound += 1;
      to.surfaces[edge.surface] = (to.surfaces[edge.surface] ?? 0) + 1;
    }
  }
  return [...map.values()];
}
