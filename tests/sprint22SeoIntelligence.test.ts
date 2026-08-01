import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assessThinContent,
  classifyPath,
  expectedCanonical,
  findDuplicateTitles,
  isSitemapEligible,
  PAGE_TYPE_CONTRACTS,
  resolveIndexability,
  scoreUrlQuality,
  seoToCsv,
  seoToJson,
  MATCH_LIFECYCLE_POLICIES,
  policyForLifecycle,
} from "../lib/seo-intelligence";
import { buildPublicRouteInventory } from "../lib/crawl-quality/inventory";
import { expectedSitemapUrls } from "../lib/crawl-quality/sitemap";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("sprint 22 seo intelligence files exist", () => {
  for (const rel of [
    "lib/seo-intelligence/contracts.ts",
    "lib/seo-intelligence/page-types.ts",
    "lib/seo-intelligence/indexability.ts",
    "lib/seo-intelligence/scoring.ts",
    "lib/seo-intelligence/service.ts",
    "app/api/admin/seo/route.ts",
    "app/api/admin/seo/export/route.ts",
    "app/admin/seo/overview/page.tsx",
    "app/admin/seo/urls/page.tsx",
    "app/admin/seo/issues/page.tsx",
    "docs/seo-intelligence.md",
    "docs/seo-page-type-contracts.md",
    "docs/seo-indexability-rules.md",
    "docs/seo-content-quality.md",
    "docs/seo-url-lifecycle.md",
    "docs/sprint-22-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("page-type classification covers core surfaces", () => {
  assert.equal(classifyPath("/"), "home");
  assert.equal(classifyPath("/search"), "search");
  assert.equal(classifyPath("/fixtures/123"), "fixture");
  assert.equal(classifyPath("/acca"), "acca_studio");
  assert.equal(classifyPath("/acca/builder"), "acca_builder");
  assert.equal(classifyPath("/combo"), "combo_redirect");
  assert.equal(classifyPath("/admin/seo"), "admin");
  assert.equal(classifyPath("/archive/2026-07-20"), "archive_day");
  assert.ok(PAGE_TYPE_CONTRACTS.length >= 20);
});

test("indexability: search/acca/admin/combo are hard rules", () => {
  assert.equal(
    resolveIndexability({ pageType: "search", path: "/search" }).decision,
    "NOINDEX"
  );
  assert.equal(
    resolveIndexability({ pageType: "acca_builder", path: "/acca/builder" })
      .decision,
    "NOINDEX"
  );
  assert.equal(
    resolveIndexability({ pageType: "admin", path: "/admin" }).decision,
    "EXCLUDED"
  );
  assert.equal(
    resolveIndexability({ pageType: "combo_redirect", path: "/combo" }).decision,
    "REDIRECT"
  );
  assert.equal(
    isSitemapEligible("REDIRECT", "combo_redirect"),
    false
  );
  assert.equal(isSitemapEligible("NOINDEX", "search"), false);
  assert.equal(isSitemapEligible("INDEX", "methodology"), true);
});

test("thin detection uses structural signals not filler rewards", () => {
  const thin = assessThinContent({
    hasPrimaryEntity: false,
    hasPublishedPrediction: false,
    hasEvidence: false,
    hasArchiveValue: false,
    fixtureCount: 0,
    hasUniqueMetadata: false,
    emptyTables: true,
    placeholderValues: false,
    inboundLinks: 0,
  });
  assert.equal(thin.thin, true);
  assert.ok(thin.signals.includes("missing_primary_entity"));
});

test("quality score is explainable and overridden by hard noindex", () => {
  const score = scoreUrlQuality({
    decision: "NOINDEX",
    hasPrimaryEntity: true,
    hasTitle: true,
    hasDescription: true,
    factualBlocks: 3,
    hasEvidence: true,
    hasArchiveValue: false,
    schemaOk: true,
    inboundLinks: 5,
    freshnessOk: true,
    duplicateRisk: false,
    thinSignals: 0,
    invalidState: false,
  });
  assert.equal(score.overriddenByIndexability, true);
  assert.ok(score.components.length >= 8);
  assert.ok(typeof score.total === "number");
});

test("lifecycle policies document settled vs stale", () => {
  assert.ok(MATCH_LIFECYCLE_POLICIES.length >= 8);
  const settled = policyForLifecycle("settled");
  assert.equal(settled?.preferredDecision, "INDEX");
  const stale = policyForLifecycle("stale");
  assert.equal(stale?.preferredDecision, "NOINDEX");
});

test("duplicate title detection and canonical helper", () => {
  const dupes = findDuplicateTitles([
    { path: "/a", title: "Same" },
    { path: "/b", title: "Same" },
    { path: "/c", title: "Other" },
  ]);
  assert.equal(dupes.length, 1);
  assert.match(expectedCanonical("en", "/methodology"), /\/en\/methodology$/);
});

test("inventory marks acca/combo non-indexable; sitemap excludes combo", () => {
  const routes = buildPublicRouteInventory();
  for (const p of ["/acca", "/acca/builder", "/combo"]) {
    const r = routes.find((x) => x.path === p);
    assert.ok(r, p);
    assert.equal(r!.indexable, false, p);
  }
  const urls = expectedSitemapUrls();
  assert.ok(!urls.some((u) => /\/combo(\?|$)/.test(u)));
  assert.ok(!urls.some((u) => /\/acca(\/|$|\?)/.test(u)));
  assert.ok(!urls.some((u) => /\/search(\?|$)/.test(u)));
});

test("exports omit secrets and bound rows", () => {
  const csv = seoToCsv("issues", [
    { code: "X", secret: "nope", explanation: "ok" },
  ]);
  assert.doesNotMatch(csv, /nope/);
  const json = seoToJson("urls", { token: "abc", items: [{ path: "/" }] });
  assert.doesNotMatch(json, /abc/);
});

test("admin SEO API requires auth and robots headers", () => {
  const api = readFileSync(path.join(root, "app/api/admin/seo/route.ts"), "utf8");
  assert.match(api, /requireAdminAccess/);
  assert.match(api, /noarchive/);
  assert.match(api, /rateLimit/);
  const exportRoute = readFileSync(
    path.join(root, "app/api/admin/seo/export/route.ts"),
    "utf8"
  );
  assert.match(exportRoute, /exportSeoSection/);
});

test("admin routes remain noindex in middleware", () => {
  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert.match(mw, /noindex, nofollow, noarchive/);
});
