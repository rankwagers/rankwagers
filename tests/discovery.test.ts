import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildContinueExploring,
  buildPopularResearchItems,
  getDiscoveryDiagnostics,
  isDiscoverableEntity,
  normalizeRecentHistory,
  parseRecentHistory,
  popularityFor,
  pushRecentEntity,
  recommendForEntity,
  relationshipStrength,
  resetDiscoveryAnalytics,
  resetDiscoveryCache,
  serializeRecentHistory,
  traverseFromEntity,
  type TraversalHit,
} from "../lib/discovery";
import { rankCandidates } from "../lib/discovery/ranking";
import { listOperators } from "../lib/operators/registry";

const root = path.resolve(__dirname, "..");

test("graph traversal returns neighbors and prevents cycles", () => {
  resetDiscoveryCache();
  const hits = traverseFromEntity("competition", "premier-league", 2);
  assert.ok(hits.length > 0);
  const ids = hits.map((hit) => `${hit.entityType}:${hit.slug}`);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(hits.every((hit) => hit.distance >= 1 && hit.distance <= 2));
  assert.ok(!ids.includes("competition:premier-league"));
});

test("relationship strength is deterministic for known kinds", () => {
  assert.ok(relationshipStrength("hosts") >= relationshipStrength("related"));
  assert.ok(relationshipStrength("has_market") > relationshipStrength("future"));
});

test("ranking prefers closer stronger relationships", () => {
  const hits: TraversalHit[] = [
    {
      entityType: "team",
      slug: "far",
      title: "Far",
      path: "/teams/far",
      distance: 2,
      relationship: "related",
      relationshipStrength: 3,
    },
    {
      entityType: "team",
      slug: "near",
      title: "Near",
      path: "/teams/near",
      distance: 1,
      relationship: "hosts",
      relationshipStrength: 5,
    },
  ];
  const ranked = rankCandidates(hits, {
    popularity: () => 0,
    integrity: () => 1,
    freshness: () => 1,
  });
  assert.equal(ranked[0]?.slug, "near");
});

test("integrity gate rejects unknown entities", () => {
  assert.equal(isDiscoverableEntity("team", "not-a-real-team-xyz"), false);
  assert.equal(isDiscoverableEntity("competition", "premier-league"), true);
});

test("recommendation engine returns public panels without graph internals", () => {
  resetDiscoveryCache();
  resetDiscoveryAnalytics();
  const bundle = recommendForEntity(
    { entityType: "competition", slug: "premier-league" },
    { locale: "en", country: "NG", depth: 2, limitPerPanel: 6 }
  );
  assert.equal(bundle.seed.slug, "premier-league");
  assert.ok(bundle.related.length > 0);
  assert.ok(bundle.continueExploring.length > 0);
  // Warm lookup target (<50ms) — cold build may include index + graph work.
  const warm = recommendForEntity(
    { entityType: "competition", slug: "premier-league" },
    { locale: "en", country: "NG", depth: 2, limitPerPanel: 6 }
  );
  assert.ok(warm.meta.tookMs < 50, `expected warm <50ms, got ${warm.meta.tookMs}`);
  const json = JSON.stringify(bundle);
  assert.equal(json.includes("providerIds"), false);
  assert.equal(json.includes("relationshipStrength"), false);
  for (const section of bundle.related) {
    for (const item of section.items) {
      assert.ok(item.href.startsWith("/en"), item.href);
      assert.ok(item.reason);
      assert.ok(typeof item.position === "number");
    }
  }
});

test("continue exploring never dead-ends when graph has neighbors", () => {
  const steps = buildContinueExploring("competition", "premier-league", "en", "NG", 5);
  assert.ok(steps.length >= 2);
  const types = steps.map((step) => step.entityType);
  assert.ok(new Set(types).size >= 2);
});

test("country filtering hides unavailable operators in recommendations", () => {
  resetDiscoveryCache();
  const affiliate = listOperators().find(
    (op) => op.affiliateEnabled && op.supportedCountries.length > 0
  );
  if (!affiliate) return;
  const closedCountry = ["ZZ", "QQ", "YY"].find(
    (code) => !affiliate.supportedCountries.includes(code)
  );
  assert.ok(closedCountry);
  const bundle = recommendForEntity(
    { entityType: "competition", slug: "premier-league" },
    { locale: "en", country: closedCountry, limitPerPanel: 20 }
  );
  const operators = bundle.related.find((section) => section.id === "related-operator");
  if (operators) {
    assert.equal(
      operators.items.some((item) => item.slug === affiliate.slug),
      false
    );
  }
});

test("popular research is analytics or graph-score backed", () => {
  resetDiscoveryCache();
  const items = buildPopularResearchItems("en", 8);
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.href.includes("/")));
  assert.ok(typeof popularityFor("competition", "premier-league") === "number");
});

test("recent history dedupes and enforces max size", () => {
  const base = pushRecentEntity([], {
    entityType: "team",
    slug: "arsenal",
    title: "Arsenal",
    href: "/en/teams/arsenal",
  });
  const again = pushRecentEntity(base, {
    entityType: "team",
    slug: "arsenal",
    title: "Arsenal",
    href: "/en/teams/arsenal",
  });
  assert.equal(again.length, 1);
  let many = again;
  for (let i = 0; i < 20; i += 1) {
    many = pushRecentEntity(many, {
      entityType: "team",
      slug: `team-${i}`,
      title: `Team ${i}`,
      href: `/en/teams/team-${i}`,
    });
  }
  assert.equal(normalizeRecentHistory(many).length, 12);
  const roundTrip = parseRecentHistory(serializeRecentHistory(many));
  assert.equal(roundTrip.length, 12);
});

test("recommendation cache reuses warm lookups", () => {
  resetDiscoveryCache();
  const first = recommendForEntity(
    { entityType: "market", slug: "over-2-5" },
    { locale: "en" }
  );
  const second = recommendForEntity(
    { entityType: "market", slug: "over-2-5" },
    { locale: "en" }
  );
  assert.equal(first.meta.candidateCount, second.meta.candidateCount);
  assert.ok(second.meta.tookMs <= first.meta.tookMs + 5);
});

test("API and dashboard routes exist", () => {
  assert.ok(existsSync(path.join(root, "app/api/discovery/route.ts")));
  assert.ok(existsSync(path.join(root, "app/api/discovery/diagnostics/route.ts")));
  assert.ok(existsSync(path.join(root, "app/developer/discovery/page.tsx")));
  assert.ok(existsSync(path.join(root, "lib/discovery/index.ts")));
  assert.ok(existsSync(path.join(root, "components/discovery/EntityDiscoverySection.tsx")));
});

test("discovery analytics events are registered", () => {
  const types = readFileSync(path.join(root, "lib/analytics/types.ts"), "utf8");
  for (const name of [
    "recommendation_impression",
    "recommendation_click",
    "continue_exploring_click",
    "recent_click",
    "popular_click",
  ]) {
    assert.match(types, new RegExp(`"${name}"`));
  }
});

test("discovery components expose accessibility landmarks", () => {
  const section = readFileSync(
    path.join(root, "components/discovery/EntityDiscoverySection.tsx"),
    "utf8"
  );
  assert.match(section, /aria-labelledby="entity-discovery"/);
  const continueSrc = readFileSync(
    path.join(root, "components/discovery/ContinueExploring.tsx"),
    "utf8"
  );
  assert.match(continueSrc, /<nav/);
  assert.match(continueSrc, /aria-labelledby="continue-exploring"/);
  const carousel = readFileSync(
    path.join(root, "components/discovery/EntityCarousel.tsx"),
    "utf8"
  );
  assert.match(carousel, /tabIndex=\{0\}/);
});

test("diagnostics snapshot is readable", () => {
  resetDiscoveryAnalytics();
  recommendForEntity(
    { entityType: "competition", slug: "premier-league" },
    { locale: "en" }
  );
  const diagnostics = getDiscoveryDiagnostics();
  assert.ok(typeof diagnostics.averageTraversalMs === "number");
  assert.ok(typeof diagnostics.ctr.rate === "number");
  assert.ok(typeof diagnostics.cache.ttlMs === "number");
});

test("public API payload shape omits internal scores", () => {
  const bundle = recommendForEntity(
    { entityType: "team", slug: "arsenal" },
    { locale: "pt", country: "BR" }
  );
  const payload = {
    seed: bundle.seed,
    related: bundle.related,
    continueExploring: bundle.continueExploring,
    popular: bundle.popular,
    meta: bundle.meta,
  };
  const json = JSON.stringify(payload);
  assert.equal(json.includes("graphScore"), false);
  assert.equal(json.includes("integrityScore"), false);
  assert.ok(bundle.popular.every((item) => item.href.startsWith("/pt/")));
});

test("entity detail views mount EntityDiscoverySection", () => {
  for (const file of [
    "components/competitions/CompetitionDetailView.tsx",
    "components/teams/TeamDetailView.tsx",
    "components/markets/MarketDetailView.tsx",
    "components/operators/OperatorDetailView.tsx",
    "components/seasons/SeasonDetailView.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /EntityDiscoverySection/);
  }
});
