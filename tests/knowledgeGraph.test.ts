import assert from "node:assert/strict";
import test from "node:test";
import { analyticsEventNames } from "../lib/analytics/types";
import {
  buildEntityNavigation,
  buildKnowledgeGraph,
  entityId,
  getKnowledgeGraph,
  graphBreadcrumbItems,
  graphCanonicalPath,
  graphRelatedLinkList,
  KnowledgeGraph,
  recommendRelated,
  resetKnowledgeGraphCache,
} from "../lib/knowledge-graph";

test("knowledge graph registers core entity types with relationships", () => {
  resetKnowledgeGraphCache();
  const snapshot = buildKnowledgeGraph();
  const types = new Set(snapshot.entities.map((entity) => entity.type));

  for (const type of [
    "competition",
    "market",
    "operator",
    "country",
    "evidence",
    "odds",
    "fixture",
    "season",
  ] as const) {
    assert.ok(types.has(type), `missing entity type ${type}`);
  }

  assert.ok(snapshot.entities.some((entity) => entity.id === entityId("competition", "premier-league")));
  assert.ok(snapshot.entities.some((entity) => entity.id === entityId("market", "over-2-5")));
  assert.ok(snapshot.entities.some((entity) => entity.id === entityId("operator", "1xbet")));
  assert.ok(snapshot.edges.length > 20);
});

test("relationship engine connects competition → markets → operators → evidence", () => {
  resetKnowledgeGraphCache();
  const graph = new KnowledgeGraph(buildKnowledgeGraph());
  const competitionId = entityId("competition", "premier-league");

  const markets = graph.relatedEntities(competitionId, ["market"], 10);
  const operators = graph.relatedEntities(competitionId, ["operator"], 10);
  const evidence = graph.relatedEntities(competitionId, ["evidence"], 5);
  const odds = graph.relatedEntities(competitionId, ["odds"], 5);
  const fixtures = graph.relatedEntities(competitionId, ["fixture"], 5);

  assert.ok(markets.some((entity) => entity.slug === "over-2-5"));
  assert.ok(operators.length >= 1);
  assert.equal(evidence.length, 1);
  assert.equal(odds.length, 1);
  assert.equal(fixtures.length, 1);
});

test("indexable entities have no orphan pages in the graph", () => {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph();
  const orphans = graph.hasOrphans(["competition", "market", "operator"]);
  assert.deepEqual(
    orphans.map((entity) => entity.id),
    [],
    `orphan entities: ${orphans.map((entity) => entity.id).join(", ")}`
  );
});

test("navigation and recommendations are generated automatically", () => {
  resetKnowledgeGraphCache();
  const nav = buildEntityNavigation("competition", "premier-league", "en");
  assert.ok(nav);
  assert.equal(nav!.canonicalPath, "/en/competitions/premier-league");
  assert.ok(nav!.sections.some((section) => section.label === "Markets"));
  assert.ok(nav!.sections.some((section) => section.label === "Operators"));
  assert.ok(nav!.breadcrumbs.some((item) => item.title === "Premier League"));

  const related = recommendRelated("market", "over-2-5", "en");
  assert.ok(related.relatedCompetitions.length >= 1 || related.relatedOperators.length >= 1);
  assert.ok(related.relatedEvidence.length >= 1);
  assert.ok(related.relatedOdds.length >= 1);
  assert.ok(related.relatedFixtures.length >= 1);
});

test("internal linking helpers expose related entity URLs", () => {
  resetKnowledgeGraphCache();
  const links = graphRelatedLinkList("operator", "1xbet", "en");
  assert.ok(links.length >= 3);
  assert.ok(links.every((link) => link.url.startsWith("/en")));
  assert.equal(graphCanonicalPath("operator", "1xbet", "en"), "/en/operators/1xbet");
  const crumbs = graphBreadcrumbItems("market", "over-2-5", "en");
  assert.ok(crumbs.some((item) => item.path === "/en/markets"));
  assert.ok(crumbs.some((item) => item.path === "/en/markets/over-2-5"));
});

test("analytics includes knowledge graph events", () => {
  for (const name of [
    "entity_view",
    "entity_navigation",
    "related_click",
    "graph_navigation",
    "recommendation_click",
  ] as const) {
    assert.ok(analyticsEventNames.includes(name), `missing analytics event ${name}`);
  }
});

test("future entity types are supported without breaking the graph", () => {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph();
  assert.ok(graph.listByType("team").length >= 1);
  assert.deepEqual(graph.listByType("player"), []);
  assert.deepEqual(graph.listByType("venue"), []);
  assert.ok(graph.listByType("season").length >= 1);
});
