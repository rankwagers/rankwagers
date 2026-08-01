import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { editDistance, fuzzyMatches } from "../lib/search/fuzzy";
import { resetSearchIndexCache } from "../lib/search/cache";
import { buildSearchIndex } from "../lib/search/indexer";
import { searchEntities } from "../lib/search/engine";
import { buildCountryLanding, listIndexableCountryCodes } from "../lib/countries/landing";
import { countryLandingIndexability, searchResultsIndexability } from "../lib/seo/indexability";
import { DISCOVERY_GRAPH_VOCABULARY } from "../lib/knowledge-graph/contracts";
import {
  getKnowledgeGraph,
  resetKnowledgeGraphCache,
} from "../lib/knowledge-graph/graph";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("fuzzy matcher tolerates single-character typos", () => {
  assert.equal(editDistance("arsenal", "arsnal", 2), 1);
  assert.ok(fuzzyMatches("arsenal", "arsnal"));
  assert.equal(fuzzyMatches("ab", "ac"), false);
});

test("search index includes countries and resolves fixture deep links when archived", () => {
  resetSearchIndexCache();
  const index = buildSearchIndex();
  assert.ok(index.counts.country >= 6);
  assert.ok(index.documents.some((doc) => doc.entityType === "country"));

  const countryHit = searchEntities("brazil", { locale: "en" });
  assert.ok(
    countryHit.results.some(
      (row) => row.entityType === "country" && row.href.includes("/countries/")
    )
  );

  if (index.counts.fixture > 0) {
    const fixtureDoc = index.documents.find((doc) => doc.entityType === "fixture");
    assert.ok(fixtureDoc);
    const response = searchEntities(fixtureDoc!.title.split(" vs ")[0] ?? "vs", {
      locale: "en",
      entityTypes: ["fixture"],
      limit: 20,
    });
    assert.ok(response.results.every((row) => row.href.includes("/fixtures/")));
  }
});

test("search ranking exposes fuzzy tier for near-miss titles", () => {
  resetSearchIndexCache();
  // "arsnal" should still surface Arsenal via fuzzy when exact/contains miss
  const response = searchEntities("arsnal", { locale: "en", limit: 10 });
  assert.ok(response.results.some((row) => /arsenal/i.test(row.title)));
});

test("country landing quality gate rejects doorway-thin hubs", () => {
  assert.equal(searchResultsIndexability().indexable, false);
  const thin = countryLandingIndexability({
    hasProfile: true,
    competitionCount: 1,
    operatorCount: 1,
    uniqueSummaryLength: 40,
    fixtureSampleCount: 0,
  });
  assert.equal(thin.indexable, false);

  const codes = listIndexableCountryCodes();
  assert.ok(codes.length >= 1);
  for (const code of codes.slice(0, 3)) {
    const model = buildCountryLanding("en", code);
    assert.ok(model);
    assert.equal(model!.indexability.indexable, true);
    assert.ok(model!.summary.length >= 80);
    assert.ok(model!.competitions.length >= 1);
    assert.ok(model!.operators.length >= 1);
  }
});

test("knowledge graph country paths point at country hubs", () => {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph();
  const gb = graph.getEntity("country:GB");
  assert.ok(gb);
  assert.match(gb!.path, /\/countries\/gb/i);
  assert.ok((DISCOVERY_GRAPH_VOCABULARY as readonly string[]).includes("fixture"));
  assert.ok((DISCOVERY_GRAPH_VOCABULARY as readonly string[]).includes("archive"));
});

test("global search UI supports highlight, recent queries, and expanded entity labels", () => {
  const src = readFileSync(
    path.join(root, "components/search/GlobalSearch.tsx"),
    "utf8"
  );
  assert.match(src, /HighlightMatch/);
  assert.match(src, /rememberSearchQuery/);
  assert.match(src, /fixtures, teams, competitions/);
  assert.match(src, /Recent searches/);
});

test("country routes and sitemap shard exist", () => {
  assert.match(
    readFileSync(path.join(root, "app/[locale]/countries/[code]/page.tsx"), "utf8"),
    /buildCountryLanding/
  );
  assert.match(
    readFileSync(path.join(root, "app/sitemap.ts"), "utf8"),
    /countries/
  );
  assert.match(
    readFileSync(path.join(root, "lib/seo/indexability.ts"), "utf8"),
    /doorway_risk/
  );
});
