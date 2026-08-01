import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildHealthReport } from "../lib/monitoring/health";
import { buildSecurityHeaders } from "../lib/security/headers";
import {
  rateLimit,
  resetRateLimitBuckets,
} from "../lib/security/rateLimit";
import { validateStructuredData } from "../lib/seo/validate";
import { hreflangLanguages, pageMetadata } from "../lib/seo";

const root = path.resolve(__dirname, "..");

test("security headers include CSP framing and environment-aware HSTS", () => {
  const prevApp = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  const headers = buildSecurityHeaders();
  const keys = headers.map((header) => header.key);
  for (const key of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Cross-Origin-Opener-Policy",
  ]) {
    assert.ok(keys.includes(key), `missing header ${key}`);
  }
  const csp = headers.find((header) => header.key === "Content-Security-Policy")!.value;
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("upgrade-insecure-requests"));
  assert.ok(!csp.includes("'unsafe-eval'"), "production CSP must omit unsafe-eval");
  const hsts = headers.find((h) => h.key === "Strict-Transport-Security")!.value;
  assert.ok(!hsts.includes("preload"), "HSTS preload disabled until domain readiness");
  if (prevApp === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = prevApp;
});

test("rate limiter blocks after window capacity", () => {
  resetRateLimitBuckets();
  assert.equal(rateLimit({ key: "t", limit: 2, windowMs: 60_000, now: 1000 }).allowed, true);
  assert.equal(rateLimit({ key: "t", limit: 2, windowMs: 60_000, now: 1001 }).allowed, true);
  const blocked = rateLimit({ key: "t", limit: 2, windowMs: 60_000, now: 1002 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  resetRateLimitBuckets();
});

test("health report exposes monitoring checks", () => {
  const report = buildHealthReport({ version: "test", now: Date.parse("2026-07-25T00:00:00.000Z") });
  assert.ok(["ok", "degraded", "fail"].includes(report.status));
  assert.ok(report.checks.some((check) => check.name === "site_url"));
  assert.ok(report.checks.some((check) => check.name === "odds_history"));
  assert.ok(report.checks.some((check) => check.name === "analytics"));
  assert.equal(report.ts, "2026-07-25T00:00:00.000Z");
});

test("liveness and readiness health routes exist", () => {
  assert.ok(existsSync(path.join(root, "app/api/health/route.ts")));
  assert.ok(existsSync(path.join(root, "app/api/health/ready/route.ts")));
  const live = readFileSync(path.join(root, "app/api/health/route.ts"), "utf8");
  assert.ok(live.includes('"ok"') || live.includes("'ok'"));
  assert.ok(!live.includes("buildHealthReport"));
  const ready = readFileSync(path.join(root, "app/api/health/ready/route.ts"), "utf8");
  assert.ok(ready.includes("buildReadinessReport"));
});

test("structured data generators validate without errors", () => {
  const issues = validateStructuredData("en");
  const errors = issues.filter((issue) => issue.severity === "error");
  assert.deepEqual(errors, [], JSON.stringify(errors, null, 2));
});

test("SEO metadata includes canonical hreflang OG and Twitter", () => {
  const meta = pageMetadata({
    locale: "en",
    path: "/markets/over-2-5",
    title: "Over 2.5",
    description: "Market intelligence",
  });
  assert.ok(String(meta.alternates?.canonical).includes("/en/markets/over-2-5"));
  const langs = hreflangLanguages("/markets/over-2-5");
  assert.ok(langs.en.includes("/en/markets/over-2-5"));
  assert.ok(langs["x-default"].includes("/en/markets/over-2-5"));
  assert.equal(meta.openGraph?.type, "website");
  assert.equal(meta.twitter?.card, "summary_large_image");
});

test("production readiness files exist", () => {
  for (const rel of [
    "app/api/health/route.ts",
    "app/[locale]/loading.tsx",
    "app/[locale]/error.tsx",
    "app/global-error.tsx",
    "instrumentation.ts",
    "docs/production-checklist.md",
    "lib/security/headers.cjs",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  const robots = readFileSync(path.join(root, "app/robots.ts"), "utf8");
  assert.ok(robots.includes("/developer"));
  assert.ok(robots.includes("/api/"));

  const sitemap = readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  assert.ok(sitemap.includes("generateSitemaps"));
  assert.ok(sitemap.includes('id: "operators"'));
  assert.ok(sitemap.includes('id: "teams"'));
  assert.ok(sitemap.includes('id: "seasons"'));
});

test("locale pages no longer nest duplicate main landmarks", () => {
  for (const rel of [
    "app/[locale]/operators/page.tsx",
    "app/[locale]/markets/page.tsx",
    "app/[locale]/competitions/page.tsx",
    "components/operators/OperatorDetailView.tsx",
    "components/markets/MarketDetailView.tsx",
    "components/competitions/CompetitionDetailView.tsx",
    "components/bible/RankWagersHome.tsx",
  ]) {
    const source = readFileSync(path.join(root, rel), "utf8");
    assert.equal(
      source.includes('id="main-content"'),
      false,
      `${rel} should not redefine main-content (layout owns landmark)`
    );
  }
});
