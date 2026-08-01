import { listCompetitions } from "@/lib/competitions/registry";
import { listMarkets } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { listConfiguredCountries, getCountryProfile } from "@/lib/personalization/countries";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import { countryName } from "@/lib/geoNames";
import {
  assertPublicEntity,
  entityHasGraphNeighbors,
  type PublicEntityKind,
} from "@/lib/data-quality/pipeline";
import { entityId } from "@/lib/knowledge-graph/entity";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { getPopularityWeight } from "./analytics";
import { getCachedSearchIndex, setCachedSearchIndex } from "./cache";
import { buildFixtureSearchDocuments } from "./fixtureDocuments";
import { normalizeSearchQuery, normalizeSlugKey } from "./normalizer";
import type {
  IndexedEntityType,
  SearchDocument,
  SearchIndexSnapshot,
} from "./types";

type RegistryIndexedType = Exclude<IndexedEntityType, "fixture" | "country">;

function emptyCounts(): Record<IndexedEntityType, number> {
  return {
    competition: 0,
    season: 0,
    team: 0,
    fixture: 0,
    market: 0,
    operator: 0,
    country: 0,
  };
}

function graphScoreFor(
  type: IndexedEntityType | "country",
  slug: string
): number {
  const graph = getKnowledgeGraph();
  const id =
    type === "season"
      ? entityId("season", slug)
      : entityId(type === "fixture" ? "fixture" : type, slug);
  return graph.neighbors(id).length;
}

function makeDocument(input: {
  entityType: RegistryIndexedType;
  slug: string;
  title: string;
  aliases?: readonly string[];
  keywords?: readonly string[];
  pathTemplate: string;
  competitionSlug?: string;
  urlSlug?: string;
  active?: boolean;
}): SearchDocument | null {
  const {
    entityType,
    slug,
    title,
    aliases = [],
    keywords = [],
    pathTemplate,
    competitionSlug,
    urlSlug,
    active = true,
  } = input;

  if (!active) return null;

  const gate =
    entityType === "season"
      ? assertPublicEntity("season", urlSlug ?? slug, competitionSlug)
      : assertPublicEntity(entityType as PublicEntityKind, slug);

  if (!gate.allowed) return null;

  // Seasons use season.id in the graph (e.g. premier-league-2025-26).
  if (!entityHasGraphNeighbors(entityType, slug)) return null;

  const aliasList = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  const keywordList = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))];

  return {
    id: `${entityType}:${slug}`,
    entityType,
    slug,
    title,
    aliases: aliasList,
    locale: "en",
    keywords: keywordList,
    popularityWeight: getPopularityWeight(entityType, slug),
    graphScore: graphScoreFor(entityType, slug),
    integrityScore: 1,
    searchable: true,
    active: true,
    competitionSlug,
    urlSlug,
    pathTemplate,
    normalizedSlug: normalizeSlugKey(slug),
    normalizedTitle: normalizeSearchQuery(title),
    normalizedAliases: aliasList.map((alias) => normalizeSearchQuery(alias)).filter(Boolean),
    normalizedKeywords: keywordList.map((kw) => normalizeSearchQuery(kw)).filter(Boolean),
  };
}

/** Build the unified search index from validated registry entities only. */
export function buildSearchIndex(): SearchIndexSnapshot {
  const documents: SearchDocument[] = [];
  const seen = new Set<string>();
  const counts = emptyCounts();

  for (const competition of listCompetitions()) {
    const doc = makeDocument({
      entityType: "competition",
      slug: competition.slug,
      title: competition.name,
      aliases: competition.aliases,
      keywords: [
        competition.confederation,
        competition.country ?? "",
        competition.season,
      ],
      pathTemplate: `/competitions/${competition.slug}`,
    });
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    documents.push(doc);
    counts.competition += 1;
  }

  for (const season of listSeasons()) {
    const doc = makeDocument({
      entityType: "season",
      slug: season.id,
      title: season.displayName,
      aliases: [season.yearLabel, season.slug, season.competitionSlug],
      keywords: [season.competitionSlug, season.countryCode ?? ""],
      pathTemplate: `/competitions/${season.competitionSlug}/seasons/${season.slug}`,
      competitionSlug: season.competitionSlug,
      urlSlug: season.slug,
      active: season.active,
    });
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    documents.push(doc);
    counts.season += 1;
  }

  for (const team of listTeams()) {
    const doc = makeDocument({
      entityType: "team",
      slug: team.slug,
      title: team.name,
      aliases: [
        ...(team.aliases ?? []),
        ...(team.shortName ? [team.shortName] : []),
      ],
      keywords: [
        team.countryCode ?? "",
        ...team.competitionSlugs,
      ],
      pathTemplate: `/teams/${team.slug}`,
      active: team.active,
    });
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    documents.push(doc);
    counts.team += 1;
  }

  for (const market of listMarkets()) {
    const doc = makeDocument({
      entityType: "market",
      slug: market.slug,
      title: market.name,
      aliases: [market.shortDescription],
      keywords: [market.category, ...(market.relatedLeagues ?? [])],
      pathTemplate: `/markets/${market.slug}`,
    });
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    documents.push(doc);
    counts.market += 1;
  }

  for (const operator of listOperators()) {
    if (!operator.affiliateEnabled) continue;
    const doc = makeDocument({
      entityType: "operator",
      slug: operator.slug,
      title: operator.name,
      aliases: [],
      keywords: [...operator.supportedCountries, ...operator.supportedMarkets],
      pathTemplate: `/operators/${operator.slug}`,
    });
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    documents.push(doc);
    counts.operator += 1;
  }

  for (const code of listConfiguredCountries()) {
    const profile = getCountryProfile(code);
    const title = countryName(code);
    const slug = code.toLowerCase();
    const id = `country:${slug}`;
    if (seen.has(id)) continue;
    if (!entityHasGraphNeighbors("country", code)) continue;
    const aliases = [code, slug, title, ...profile.topLeagues];
    documents.push({
      id,
      entityType: "country",
      slug,
      title,
      aliases,
      locale: profile.language,
      keywords: [...profile.topLeagues, ...profile.supportedPartners],
      popularityWeight: 0.55,
      graphScore: graphScoreFor("country", code),
      integrityScore: 1,
      searchable: true,
      active: true,
      pathTemplate: `/countries/${slug}`,
      normalizedSlug: normalizeSlugKey(slug),
      normalizedTitle: normalizeSearchQuery(title),
      normalizedAliases: aliases.map((alias) => normalizeSearchQuery(alias)).filter(Boolean),
      normalizedKeywords: profile.topLeagues
        .map((league) => normalizeSearchQuery(league))
        .filter(Boolean),
    });
    seen.add(id);
    counts.country += 1;
  }

  for (const fixtureDoc of buildFixtureSearchDocuments(3)) {
    if (seen.has(fixtureDoc.id)) continue;
    seen.add(fixtureDoc.id);
    documents.push(fixtureDoc);
    counts.fixture += 1;
  }

  return {
    documents,
    builtAt: Date.now(),
    counts,
    size: documents.length,
  };
}

export function getSearchIndex(options?: { force?: boolean }): SearchIndexSnapshot {
  if (!options?.force) {
    const cached = getCachedSearchIndex();
    if (cached) return cached;
  }
  const snapshot = buildSearchIndex();
  setCachedSearchIndex(snapshot);
  return snapshot;
}

/** Incremental rebuild: re-read registries into a fresh cached snapshot (no provider I/O). */
export function rebuildSearchIndex(): SearchIndexSnapshot {
  return getSearchIndex({ force: true });
}
