import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildSearchIndex,
  getSearchDiagnostics,
  getSearchIndex,
  normalizeSearchQuery,
  normalizeSlugKey,
  rebuildSearchIndex,
  recordEntityView,
  recordSearchResultClick,
  resetSearchAnalytics,
  resetSearchIndexCache,
  searchEntities,
  SEARCH_GROUP_ORDER,
  type SearchResult,
} from "../lib/search";
import { listOperators } from "../lib/operators/registry";
import { resolveOperatorAvailability } from "../lib/operators/availability";

const root = path.resolve(__dirname, "..");

test("normalization collapses case, hyphens, accents, and club tokens", () => {
  assert.equal(normalizeSearchQuery("Real Madrid"), "real madrid");
  assert.equal(normalizeSearchQuery("real madrid"), "real madrid");
  assert.equal(normalizeSearchQuery("REAL-MADRID"), "real madrid");
  assert.equal(normalizeSearchQuery("  FC  Barcelona  "), "barcelona");
  assert.equal(normalizeSearchQuery("São Paulo"), "sao paulo");
  assert.equal(normalizeSlugKey("real-madrid"), "real-madrid");
});

test("alias and abbreviation normalization resolves common football short forms", () => {
  assert.equal(normalizeSearchQuery("man utd"), "manchester united");
  assert.equal(normalizeSearchQuery("PSG"), "paris saint germain");
});

test("index generation includes only searchable registry entities", () => {
  resetSearchIndexCache();
  resetSearchAnalytics();
  const index = buildSearchIndex();
  assert.ok(index.size > 30);
  assert.ok(index.counts.competition > 0);
  assert.ok(index.counts.team > 0);
  assert.ok(index.counts.market > 0);
  assert.ok(index.counts.season > 0);
  assert.ok(index.counts.operator >= 0);
  assert.ok(index.documents.every((doc) => doc.searchable && doc.active));
  assert.ok(index.documents.every((doc) => !doc.id.includes("provider")));
  // Short-horizon fixtures from daily archives (when available).
  assert.ok(typeof index.counts.fixture === "number");
  assert.ok(typeof index.counts.country === "number");
  assert.ok(index.counts.country > 0);
});

test("integrity filtering excludes unknown / inactive entities from public search", () => {
  resetSearchIndexCache();
  const response = searchEntities("not-a-real-team-xyz-999", { locale: "en" });
  assert.equal(response.results.length, 0);
  assert.equal(response.meta.emptyReason, "no_results");
});

test("duplicate entities are suppressed in results", () => {
  resetSearchIndexCache();
  const response = searchEntities("premier league", { locale: "en", limit: 40 });
  const keys = response.results.map((row) => `${row.entityType}:${row.slug}`);
  assert.equal(keys.length, new Set(keys).size);
});

test("ranking prefers exact slug / title over contains", () => {
  resetSearchIndexCache();
  const response = searchEntities("arsenal", { locale: "en" });
  assert.ok(response.results.length > 0);
  const top = response.results[0];
  assert.ok(top);
  assert.match(top.title.toLowerCase(), /arsenal/);
  assert.ok(top.href.startsWith("/en/"));
});

test("alias resolution finds teams by alternate names when present", () => {
  resetSearchIndexCache();
  const index = getSearchIndex({ force: true });
  const withAlias = index.documents.find(
    (doc) => doc.entityType === "team" && doc.aliases.length > 0
  );
  assert.ok(withAlias, "expected at least one team with aliases");
  const alias = withAlias.aliases[0];
  assert.ok(alias);
  const response = searchEntities(alias, { locale: "en" });
  assert.ok(
    response.results.some(
      (row) => row.entityType === "team" && row.slug === withAlias.slug
    ),
    `alias "${alias}" should resolve to ${withAlias.slug}`
  );
});

test("results are grouped by entity type without mixing labels", () => {
  resetSearchIndexCache();
  const response = searchEntities("united", { locale: "en", limit: 40 });
  for (const key of SEARCH_GROUP_ORDER) {
    const group = response.groups[key];
    if (!group) continue;
    assert.ok(group.every((row) => row.group === key && row.entityType === key));
  }
  // Flat results preserve group membership.
  assert.ok(response.results.every((row) => row.group === row.entityType));
});

test("locale is applied to result hrefs", () => {
  resetSearchIndexCache();
  const en = searchEntities("market", { locale: "en", entityTypes: ["market"] });
  const pt = searchEntities("market", { locale: "pt", entityTypes: ["market"] });
  if (en.results[0]) assert.ok(en.results[0].href.startsWith("/en/"));
  if (pt.results[0]) assert.ok(pt.results[0].href.startsWith("/pt/"));
});

test("country filtering hides unavailable operators", () => {
  resetSearchIndexCache();
  const affiliate = listOperators().find((op) => op.affiliateEnabled);
  assert.ok(affiliate, "need an affiliate-enabled operator for this test");

  const availableCountry = affiliate.supportedCountries[0] ?? "NG";
  const unavailableCountry = ["XX", "ZZ", "QQ"].find(
    (code) => !affiliate.supportedCountries.includes(code)
  );
  assert.ok(unavailableCountry);

  // Confirm availability helper agrees.
  if (affiliate.supportedCountries.length) {
    assert.equal(
      resolveOperatorAvailability(affiliate, unavailableCountry).available,
      false
    );
  }

  const open = searchEntities(affiliate.name, {
    locale: "en",
    country: availableCountry,
    entityTypes: ["operator"],
  });
  const closed = searchEntities(affiliate.name, {
    locale: "en",
    country: unavailableCountry,
    entityTypes: ["operator"],
  });

  if (affiliate.supportedCountries.length) {
    assert.ok(
      open.results.some((row) => row.slug === affiliate.slug) ||
        open.meta.count >= 0
    );
    assert.equal(
      closed.results.some((row) => row.slug === affiliate.slug),
      false
    );
  }
});

test("public API payload shape has no provider IDs or internal scores", () => {
  resetSearchIndexCache();
  const response = searchEntities("league", { locale: "en" });
  const json = JSON.stringify(response);
  assert.equal(json.includes("providerIds"), false);
  assert.equal(json.includes("graphScore"), false);
  assert.equal(json.includes("integrityScore"), false);
  assert.equal(json.includes("normalizedTitle"), false);
  for (const row of response.results) {
    assert.ok(row.entityType);
    assert.ok(row.slug);
    assert.ok(row.title);
    assert.ok(row.href);
    assert.ok(row.group);
  }
});

test("cache reuse avoids full rebuild on warm getSearchIndex", () => {
  resetSearchIndexCache();
  const first = getSearchIndex({ force: true });
  const second = getSearchIndex();
  assert.equal(first.builtAt, second.builtAt);
  const rebuilt = rebuildSearchIndex();
  assert.ok(rebuilt.builtAt >= first.builtAt);
});

/**
 * The search index is a CACHE, not an algorithmic index.
 *
 * `rankDocuments` is a linear scan over `index.documents`; there is no inverted index and no token
 * map, so an "unindexed" lookup would run the identical scan. What `getSearchIndex` saves is the
 * BUILD — reading every registry into a fresh snapshot — which is why the property worth guarding
 * is "a warm lookup skips the rebuild", not "a lookup is fast".
 *
 * Measured as a ratio taken in the same run rather than as wall-clock. The assertion this replaced
 * read `elapsed < 50` and failed at 54.99ms and 70.5ms under load while passing in isolation: a
 * warm lookup costs ~6ms here, so the 50ms budget was already eight times the real figure and it
 * still cried wolf. Machine load scales cold and warm together, so a ratio cancels it; an absolute
 * bound cannot.
 *
 * What it catches: the cache being dropped, bypassed, or rebuilt per query — any of which collapses
 * the ratio to ~1x.
 *
 * What it deliberately does not catch: both paths becoming uniformly slower. That is a wall-clock
 * question, and wall-clock cannot be asserted reliably on a shared machine. A regression of that
 * shape needs a benchmark with a controlled environment, not a unit test.
 */
const LOOKUP_QUERY = "arsenal";
const LOOKUP_SAMPLES = 9;
/** Observed margin is ~12.5x. A third of it, so a busy CPU cannot reach the floor. */
const MIN_CACHE_SPEEDUP = 4;

function medianOf(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function timeLookup(): number {
  const started = performance.now();
  searchEntities(LOOKUP_QUERY, { locale: "en" });
  return performance.now() - started;
}

test("a warm lookup skips the rebuild, so it is far cheaper than a cold one", () => {
  // Build once and run the query repeatedly first, so JIT compilation lands in neither sample.
  resetSearchIndexCache();
  getSearchIndex({ force: true });
  for (let i = 0; i < 20; i += 1) searchEntities(LOOKUP_QUERY, { locale: "en" });

  const cold: number[] = [];
  const warm: number[] = [];

  // Interleaved on purpose: a slow moment on the machine lands on both samples, not on one.
  for (let i = 0; i < LOOKUP_SAMPLES; i += 1) {
    resetSearchIndexCache();
    cold.push(timeLookup());
    // The cold lookup repopulated the cache, so this one is served from it.
    warm.push(timeLookup());
  }

  const coldMedian = medianOf(cold);
  const warmMedian = medianOf(warm);
  assert.ok(warmMedian > 0, "the warm lookup produced no measurable duration");

  const speedup = coldMedian / warmMedian;
  assert.ok(
    speedup >= MIN_CACHE_SPEEDUP,
    `expected the cache to save at least ${MIN_CACHE_SPEEDUP}x, got ${speedup.toFixed(
      1
    )}x (cold ${coldMedian.toFixed(2)}ms, warm ${warmMedian.toFixed(2)}ms)`
  );
});

test("a warm lookup does not rebuild the index", () => {
  // The mechanism behind the ratio, asserted directly so a failure says WHICH property broke.
  resetSearchIndexCache();
  const first = getSearchIndex();
  const second = getSearchIndex();
  assert.equal(second, first, "a warm call must return the same snapshot, not a rebuild");

  resetSearchIndexCache();
  const afterReset = getSearchIndex();
  assert.notEqual(afterReset, first, "a reset must force a fresh snapshot");
});

test("analytics helpers record clicks and power diagnostics", () => {
  resetSearchAnalytics();
  resetSearchIndexCache();
  rebuildSearchIndex();
  recordEntityView("team", "arsenal");
  recordSearchResultClick("team", "arsenal");
  searchEntities("zzzz-no-such-entity-42", { locale: "en" });
  const diagnostics = getSearchDiagnostics();
  assert.ok(diagnostics.indexSize > 0);
  assert.ok(diagnostics.entityCounts.team >= 0);
  assert.ok(
    diagnostics.mostClickedEntities.some(
      (row) => row.entityType === "team" && row.entitySlug === "arsenal"
    )
  );
  assert.ok(diagnostics.zeroResultQueries.length >= 1);
  assert.ok(typeof diagnostics.cacheStatus.warm === "boolean");
});

test("SSR search page is noindex and routes exist", () => {
  const pagePath = path.join(root, "app/[locale]/search/page.tsx");
  assert.ok(existsSync(pagePath));
  const source = readFileSync(pagePath, "utf8");
  assert.match(source, /index:\s*false/);
  assert.match(source, /searchEntities/);
  assert.ok(existsSync(path.join(root, "app/api/search/route.ts")));
  assert.ok(existsSync(path.join(root, "app/developer/search/page.tsx")));
  assert.ok(existsSync(path.join(root, "components/search/GlobalSearch.tsx")));
});

test("GlobalSearch supports keyboard navigation affordances", () => {
  const source = readFileSync(
    path.join(root, "components/search/GlobalSearch.tsx"),
    "utf8"
  );
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Escape/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /DEBOUNCE_MS/);
});

test("search analytics event names are registered", () => {
  const types = readFileSync(path.join(root, "lib/analytics/types.ts"), "utf8");
  for (const name of [
    "search_open",
    "search_query",
    "search_result_click",
    "search_empty",
    "search_filter",
    "search_keyboard_navigation",
    "search_group_expand",
  ]) {
    assert.match(types, new RegExp(`"${name}"`));
  }
});

test("grouping order matches product contract", () => {
  assert.deepEqual([...SEARCH_GROUP_ORDER], [
    "competition",
    "season",
    "team",
    "fixture",
    "market",
    "operator",
    "country",
  ]);
});

test("empty query returns no_query empty reason", () => {
  const response = searchEntities("   ", { locale: "en" });
  assert.equal(response.meta.emptyReason, "no_query");
  assert.equal(response.results.length, 0);
});

test("public results never mix unrelated entity types inside a group array", () => {
  const response = searchEntities("a", { locale: "en", limit: 50 });
  const byType = new Map<string, SearchResult[]>();
  for (const row of response.results) {
    const list = byType.get(row.entityType) ?? [];
    list.push(row);
    byType.set(row.entityType, list);
  }
  for (const [type, rows] of byType) {
    assert.ok(rows.every((row) => row.entityType === type));
  }
});
