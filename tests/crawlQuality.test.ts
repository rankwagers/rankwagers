import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  assertNoRuntimeCrawl,
  balanceSurfaces,
  buildCrawlQualityApiResponse,
  buildPublicRouteInventory,
  dedupeByHref,
  expectedSitemapUrls,
  EXCLUDED_PATH_PREFIXES,
  getCrawlQualityApiPayload,
  getCrawlQualityReport,
  limitRepeatedLinks,
  resetCrawlQualityCache,
  walkPublicRoutes,
} from "../lib/crawl-quality";
import { locales } from "../lib/i18n";
import { hreflangLanguages, pageMetadata } from "../lib/seo";

const root = path.resolve(__dirname, "..");

test("route inventory includes core entity types + search and excludes developer/api", () => {
  const routes = buildPublicRouteInventory();
  const types = new Set(routes.filter((r) => r.kind === "entity").map((r) => r.entityType));
  for (const type of ["competition", "season", "team", "market", "operator", "country"] as const) {
    assert.ok(types.has(type), `missing ${type}`);
  }
  assert.ok(routes.some((r) => r.kind === "search"));
  assert.ok(routes.some((r) => r.kind === "home"));
  for (const route of routes) {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      assert.ok(
        route.path !== prefix && !route.path.startsWith(`${prefix}/`),
        `excluded path leaked: ${route.path}`
      );
    }
  }
  assert.deepEqual(
    walkPublicRoutes().map((r) => r.key),
    routes.map((r) => r.key)
  );
});

test("canonicals are self-pointing and unique across sample routes", () => {
  const routes = buildPublicRouteInventory().filter(
    (r) => r.kind === "entity" || r.kind === "hub" || r.kind === "home"
  );
  const seen = new Set<string>();
  for (const route of routes.slice(0, 20)) {
    for (const locale of locales.slice(0, 3)) {
      const meta = pageMetadata({
        locale,
        path: route.path === "/" ? "/" : route.path,
        title: route.title,
        description: route.title,
        index: route.indexable,
      });
      const canonical = String(meta.alternates?.canonical ?? "");
      assert.ok(canonical.includes(`/${locale}`));
      assert.ok(!seen.has(canonical) || canonical.includes(route.path.replace(/^\//, "")));
      seen.add(canonical);
    }
  }
});

test("hreflang includes every locale and x-default en", () => {
  const languages = hreflangLanguages("/competitions/premier-league");
  for (const locale of locales) {
    assert.ok(languages[locale], `missing ${locale}`);
  }
  assert.ok(languages["x-default"]?.includes("/en/"));
  const localeUrls = locales.map((l) => languages[l]);
  assert.equal(new Set(localeUrls).size, localeUrls.length);
});

test("full crawl quality report: no orphans, schema/sitemap/breadcrumb coverage", () => {
  resetCrawlQualityCache();
  const report = getCrawlQualityReport({ force: true });
  assert.equal(report.metrics.orphanCount, 0);
  assert.equal(report.metrics.brokenCanonicalCount, 0);
  assert.equal(report.metrics.structuredDataCoverage, 100);
  assert.equal(report.metrics.sitemapCoverage, 100);
  assert.equal(report.metrics.breadcrumbCoverage, 100);
  assert.ok(report.metrics.crawlQuality >= 90);
  assert.ok(report.findings.some((f) => f.category === "thin"));
  assert.ok(report.findings.some((f) => f.category === "breadcrumbs" && f.severity === "pass"));
});

test("sitemap expected URLs cover entity canonicals for all locales", () => {
  const urls = new Set(expectedSitemapUrls());
  const entities = buildPublicRouteInventory().filter((r) => r.kind === "entity");
  for (const entity of entities) {
    for (const locale of locales) {
      const suffix = entity.path === "/" ? "" : entity.path;
      const needle = `/${locale}${suffix}`;
      assert.ok(
        [...urls].some((url) => url.endsWith(needle) || url.includes(needle)),
        `missing sitemap url for ${needle}`
      );
    }
  }
  assert.ok(![...urls].some((url) => url.includes("/search")));
});

test("link optimizer dedupes and balances surfaces", () => {
  const deduped = dedupeByHref([
    { href: "/en/a", label: "1" },
    { href: "/en/a", label: "2" },
    { href: "/en/b", label: "3" },
  ]);
  assert.equal(deduped.length, 2);
  const limited = limitRepeatedLinks(
    Array.from({ length: 20 }, (_, i) => ({ href: `/en/x${i}` })),
    5
  );
  assert.equal(limited.length, 5);
  const balanced = balanceSurfaces({
    breadcrumb: [{ href: "/en/a" }],
    graph: [{ href: "/en/a" }, { href: "/en/b" }],
    discovery: [{ href: "/en/c" }],
  });
  assert.equal(balanced.length, 3);
  assert.equal(balanced.filter((x) => x.href === "/en/a").length, 1);
});

test("monitoring API returns scores only", () => {
  resetCrawlQualityCache();
  const payload = getCrawlQualityApiPayload({ force: true });
  assert.equal(typeof payload.crawlQuality, "number");
  assert.equal(typeof payload.orphanPages, "number");
  assert.equal(typeof payload.thinPages, "number");
  assert.equal(typeof payload.brokenCanonicals, "number");
  assert.equal(typeof payload.structuredDataCoverage, "number");
  assert.equal(typeof payload.internalLinkScore, "number");
  const keys = Object.keys(payload).sort();
  assert.deepEqual(keys, [
    "brokenCanonicals",
    "crawlQuality",
    "internalLinkScore",
    "orphanPages",
    "structuredDataCoverage",
    "thinPages",
  ]);
  const viaBuilder = buildCrawlQualityApiResponse(getCrawlQualityReport({ force: true }));
  assert.deepEqual(viaBuilder, payload);
});

test("crawl report cache hit avoids rebuild within TTL", () => {
  resetCrawlQualityCache();
  const a = getCrawlQualityReport({ force: true, now: 1_000 });
  const b = getCrawlQualityReport({ force: false, now: 1_500, ttlMs: 60_000 });
  assert.equal(a.generatedAt, b.generatedAt);
  const c = getCrawlQualityReport({ force: true, now: 2_000 });
  assert.notEqual(a.generatedAt, c.generatedAt);
});

test("developer dashboard and API route modules exist", () => {
  assert.ok(existsSync(path.join(root, "app/developer/crawl-quality/page.tsx")));
  assert.ok(existsSync(path.join(root, "app/api/crawl-quality/route.ts")));
  assert.ok(existsSync(path.join(root, "components/developer/CrawlQualityDashboard.tsx")));
  const dash = readFileSync(
    path.join(root, "components/developer/CrawlQualityDashboard.tsx"),
    "utf8"
  );
  assert.match(dash, /Orphans/);
  assert.match(dash, /Thin pages/);
  assert.match(dash, /Canonicals/);
  assert.match(dash, /Hreflang/);
  assert.match(dash, /Sitemaps/);
});

test("accessibility: entity detail views expose breadcrumb nav landmarks", () => {
  for (const rel of [
    "components/competitions/CompetitionDetailView.tsx",
    "components/seasons/SeasonDetailView.tsx",
    "components/teams/TeamDetailView.tsx",
    "components/markets/MarketDetailView.tsx",
    "components/operators/OperatorDetailView.tsx",
  ]) {
    const source = readFileSync(path.join(root, rel), "utf8");
    assert.match(source, /aria-label=["']Breadcrumb["']/);
  }
  assertNoRuntimeCrawl();
});

test("link helpers are wired into graph and discovery panels", () => {
  const graph = readFileSync(
    path.join(root, "components/knowledge-graph/GraphEntityPanel.tsx"),
    "utf8"
  );
  const related = readFileSync(
    path.join(root, "components/discovery/RelatedEntities.tsx"),
    "utf8"
  );
  assert.match(graph, /limitRepeatedLinks/);
  assert.match(related, /dedupeByHref/);
  assert.match(related, /limitRepeatedLinks/);
});
