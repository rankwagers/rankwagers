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
  buildTeamIntelligence,
  fixturesForTeam,
} from "../lib/teams/intelligence";
import { teamPath, teamsIndexPath } from "../lib/teams/links";
import { operatorsForTeam } from "../lib/teams/operators";
import {
  ensureUniqueSlugs,
  getTeam,
  listTeams,
  resolveRegisteredTeam,
  teamSlugs,
} from "../lib/teams/registry";
import { normalizeTeamName, resolveTeam } from "../lib/teams/resolver";
import {
  teamBreadcrumbLd,
  teamWebPageLd,
} from "../lib/teams/schema";
import { teamMetadata, teamPageTitle } from "../lib/teams/seo";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";

function fixture(
  partial: Partial<QualifiedFixture> & Pick<QualifiedFixture, "id" | "matchId" | "home" | "away">
): QualifiedFixture {
  return {
    marketKind: "over25",
    league: "Premier League",
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

test("team registry has unique active slugs and major clubs", () => {
  assert.deepEqual(ensureUniqueSlugs(), []);
  assert.ok(teamSlugs().includes("arsenal"));
  assert.ok(teamSlugs().includes("real-madrid"));
  assert.ok(teamSlugs().includes("flamengo"));
  assert.ok(teamSlugs().includes("kashima-antlers"));
  assert.ok(listTeams().length >= 30);
});

test("alias normalization and ambiguous rejection", () => {
  assert.equal(normalizeTeamName("FC Bayern München"), "bayern munchen");
  const arsenal = resolveRegisteredTeam({ name: "Arsenal FC" });
  assert.equal(arsenal.status, "matched");
  if (arsenal.status === "matched") assert.equal(arsenal.team.slug, "arsenal");

  const psg = resolveRegisteredTeam({ name: "PSG" });
  assert.equal(psg.status, "matched");

  const ambiguous = resolveTeam(listTeams(), {
    name: "United",
    competitionSlug: "premier-league",
  });
  assert.notEqual(ambiguous.status, "matched");
});

test("provider and competition-aware resolution", () => {
  const withProvider = resolveTeam(
    [
      {
        ...getTeam("arsenal")!,
        providerIds: { footyStats: 99 },
      },
    ],
    { providerIds: { footyStats: 99 } }
  );
  assert.equal(withProvider.status, "matched");
  if (withProvider.status === "matched") assert.equal(withProvider.method, "provider");
});

test("routing helpers and metadata avoid tipster language", () => {
  assert.equal(teamsIndexPath("en"), "/en/teams");
  assert.equal(teamPath("en", "liverpool"), "/en/teams/liverpool");
  const team = getTeam("liverpool")!;
  const title = teamPageTitle(team);
  assert.ok(title.includes("Liverpool"));
  assert.ok(!/prediction|guaranteed|winning|best bet|sure bet/i.test(title));
  const meta = teamMetadata("en", team);
  assert.ok(String(meta.alternates?.canonical).includes("/en/teams/liverpool"));
});

test("fixture and intelligence relationships stay factual", () => {
  const team = getTeam("arsenal")!;
  const rows = [
    fixture({ id: "1", matchId: 1, home: "Arsenal", away: "Chelsea", modelProbability: 80 }),
    fixture({ id: "2", matchId: 2, home: "Liverpool", away: "Arsenal FC", modelProbability: 60 }),
    fixture({ id: "3", matchId: 3, home: "Barcelona", away: "Real Madrid", modelProbability: 90 }),
  ];
  assert.equal(fixturesForTeam(team, rows).length, 2);
  const intel = buildTeamIntelligence(team, rows);
  assert.equal(intel.matchesInSample, 2);
  assert.equal(intel.uniqueMatchCount, 2);
  assert.equal(intel.homeAppearances, 1);
  assert.equal(intel.awayAppearances, 1);
  assert.equal(intel.hasGoalEnrichment, false);
  assert.ok(intel.marketProfile.length >= 1);
});

test("operators personalize by visitor country availability", () => {
  const team = getTeam("flamengo")!;
  const br = operatorsForTeam(team, "BR");
  assert.ok(br.length >= 1);
  assert.ok(br.every((row) => row.operator.affiliateEnabled));
});

test("structured data uses SportsTeam WebPage and breadcrumbs", () => {
  const team = getTeam("barcelona")!;
  const web = teamWebPageLd({ team, locale: "en" });
  assert.equal(web["@type"], "WebPage");
  assert.equal((web.about as { "@type": string })["@type"], "SportsTeam");
  const crumbs = teamBreadcrumbLd({ team, locale: "en" });
  assert.equal(crumbs["@type"], "BreadcrumbList");
});

test("knowledge graph registers teams without orphans", () => {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph();
  assert.ok(graph.getEntity(entityId("team", "arsenal")));
  const orphans = graph.hasOrphans(["team"]);
  assert.deepEqual(orphans.map((entity) => entity.id), []);
  const related = graph.relatedEntities(entityId("team", "arsenal"), ["competition"], 5);
  assert.ok(related.some((entity) => entity.slug === "premier-league"));
});

test("team analytics events and routes exist", () => {
  for (const name of [
    "team_page_view",
    "team_fixture_click",
    "team_competition_click",
    "team_market_click",
    "team_operator_click",
    "team_evidence_expand",
    "team_related_click",
  ] as const) {
    assert.ok(analyticsEventNames.includes(name), `missing ${name}`);
  }
  const root = path.resolve(__dirname, "..");
  assert.ok(existsSync(path.join(root, "app/[locale]/teams/page.tsx")));
  assert.ok(existsSync(path.join(root, "app/[locale]/teams/[slug]/page.tsx")));
});
