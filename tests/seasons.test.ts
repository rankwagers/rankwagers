import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { analyticsEventNames } from "../lib/analytics/types";
import {
  getKnowledgeGraph,
  resetKnowledgeGraphCache,
} from "../lib/knowledge-graph";
import { entityId } from "../lib/knowledge-graph/entity";
import {
  buildSeasonIntelligence,
  fixturesForSeason,
  participatingTeams,
} from "../lib/seasons/intelligence";
import { seasonPath, seasonsIndexPath } from "../lib/seasons/links";
import { operatorsForSeason } from "../lib/seasons/operators";
import {
  ensureUniqueSeasonIds,
  getActiveSeason,
  getSeason,
  listSeasons,
  resolveRegisteredSeason,
  seasonSlugs,
} from "../lib/seasons/registry";
import { resolveSeason, yearLabelToSlug } from "../lib/seasons/resolver";
import {
  seasonBreadcrumbLd,
  seasonCollectionPageLd,
} from "../lib/seasons/schema";
import { seasonMetadata, seasonPageTitle } from "../lib/seasons/seo";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";

function fixture(
  partial: Partial<QualifiedFixture> & Pick<QualifiedFixture, "id" | "matchId" | "home" | "away" | "league">
): QualifiedFixture {
  return {
    marketKind: "over25",
    leagueCode: "PL",
    kickoff: "12:00",
    kickoffDateTime: "2026-07-25T12:00:00.000Z",
    market: "Over 2.5 Goals",
    marketCode: "O2.5",
    modelProbability: 70,
    updatedAt: "now",
    updatedDateTime: "2026-07-25T10:00:00.000Z",
    venue: "Venue data pending",
    operatorStatus: "unavailable",
    ...partial,
  };
}

test("season registry is unique and competition-backed", () => {
  assert.deepEqual(ensureUniqueSeasonIds(), []);
  assert.ok(listSeasons().length >= 10);
  const pl = getSeason("premier-league", "2025-26");
  assert.ok(pl);
  assert.equal(pl!.yearLabel, "2025/26");
  assert.equal(pl!.active, true);
  assert.equal(getActiveSeason("premier-league")?.slug, "2025-26");
  assert.ok(seasonSlugs().some((row) => row.competition === "la-liga"));
});

test("season resolver priority and ambiguous rejection", () => {
  assert.equal(yearLabelToSlug("2025/26"), "2025-26");
  const bySlug = resolveRegisteredSeason({
    competitionSlug: "premier-league",
    seasonSlug: "2025-26",
  });
  assert.equal(bySlug.status, "matched");

  const active = resolveRegisteredSeason({ competitionSlug: "premier-league" });
  assert.equal(active.status, "matched");

  const archived = {
    ...getSeason("premier-league", "2025-26")!,
    id: "premier-league-2024-25",
    slug: "2024-25",
    yearLabel: "2024/25",
    active: false,
  };
  const rejected = resolveSeason([archived], {
    competitionSlug: "premier-league",
    seasonSlug: "2024-25",
    activeOnly: true,
  });
  assert.equal(rejected.status, "unmatched");
});

test("routing helpers and metadata avoid tipster language", () => {
  assert.equal(seasonsIndexPath("en"), "/en/seasons");
  assert.equal(
    seasonPath("en", "premier-league", "2025-26"),
    "/en/competitions/premier-league/seasons/2025-26"
  );
  const season = getSeason("premier-league", "2025-26")!;
  const title = seasonPageTitle(season);
  assert.ok(title.includes("Premier League"));
  assert.ok(!/prediction|tips|winning|sure bet|guaranteed/i.test(title));
  const meta = seasonMetadata("en", season);
  assert.ok(
    String(meta.alternates?.canonical).includes(
      "/en/competitions/premier-league/seasons/2025-26"
    )
  );
});

test("fixture evidence market intelligence stays factual", () => {
  const season = getSeason("premier-league", "2025-26")!;
  const rows = [
    fixture({
      id: "1",
      matchId: 1,
      home: "Arsenal",
      away: "Chelsea",
      league: "Premier League",
      modelProbability: 80,
    }),
    fixture({
      id: "2",
      matchId: 2,
      home: "Barcelona",
      away: "Real Madrid",
      league: "La Liga",
      modelProbability: 90,
    }),
  ];
  assert.equal(fixturesForSeason(season, rows).length, 1);
  const intel = buildSeasonIntelligence(season, rows);
  assert.equal(intel.qualifiedFixtureCount, 1);
  assert.equal(intel.hasGoalEnrichment, false);
  assert.ok(intel.marketProfile.length >= 1);
  const teams = participatingTeams(season, rows);
  assert.ok(teams.some((team) => team.slug === "arsenal"));
});

test("operators only include country-available affiliates", () => {
  const season = getSeason("premier-league", "2025-26")!;
  const rows = operatorsForSeason(season, "NG");
  assert.ok(rows.every((row) => row.availability.available));
  assert.ok(rows.every((row) => row.operator.affiliateEnabled));
});

test("structured data uses CollectionPage breadcrumbs and organization", () => {
  const season = getSeason("la-liga", "2025-26")!;
  const page = seasonCollectionPageLd({ season, locale: "en" });
  assert.equal(page["@type"], "CollectionPage");
  assert.equal((page.about as { "@type": string })["@type"], "SportsOrganization");
  const crumbs = seasonBreadcrumbLd({ season, locale: "en" });
  assert.equal(crumbs["@type"], "BreadcrumbList");
});

test("knowledge graph registers seasons without orphans", () => {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph();
  const id = entityId("season", "premier-league-2025-26");
  assert.ok(graph.getEntity(id));
  assert.deepEqual(
    graph.hasOrphans(["season"]).map((entity) => entity.id),
    []
  );
  const competitions = graph.relatedEntities(id, ["competition"], 3);
  assert.ok(competitions.some((entity) => entity.slug === "premier-league"));
});

test("season analytics events and routes exist", () => {
  for (const name of [
    "season_page_view",
    "season_fixture_click",
    "season_team_click",
    "season_market_click",
    "season_operator_click",
    "season_graph_navigation",
  ] as const) {
    assert.ok(analyticsEventNames.includes(name), `missing ${name}`);
  }
  const root = path.resolve(__dirname, "..");
  assert.ok(existsSync(path.join(root, "app/[locale]/seasons/page.tsx")));
  assert.ok(
    existsSync(
      path.join(root, "app/[locale]/competitions/[slug]/seasons/[season]/page.tsx")
    )
  );
});
