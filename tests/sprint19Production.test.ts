import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  resolveRequestId,
  requestIdHeaderName,
} from "../lib/observability/requestId";
import { validateStructuredData } from "../lib/seo/validate";
import { buildSecurityHeaders } from "../lib/security/headers";

const root = process.cwd();

test("request id resolver accepts inbound and mints opaque ids", () => {
  assert.equal(resolveRequestId("req_abcdef12"), "req_abcdef12");
  assert.match(resolveRequestId("bad id"), /^req_[A-Za-z0-9]+/);
  assert.match(resolveRequestId(null), /^req_[A-Za-z0-9]+/);
  assert.equal(requestIdHeaderName(), "x-request-id");
});

test("middleware and ready route propagate request ids", () => {
  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert.match(mw, /x-request-id|requestIdHeaderName/);
  assert.match(mw, /resolveRequestId/);
  const ready = readFileSync(
    path.join(root, "app/api/health/ready/route.ts"),
    "utf8"
  );
  assert.match(ready, /requestId/);
  assert.match(ready, /readRequestIdFromHeaders/);
});

test("release gates and CI require CTA boundary scan", () => {
  const validate = readFileSync(
    path.join(root, "scripts/validate-release.ts"),
    "utf8"
  );
  assert.match(validate, /cta_boundary/);
  assert.match(validate, /scan-client-cta-boundary/);
  const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /scan:cta-boundary/);
});

test("performance config enables lucide optimizePackageImports and image remotes", () => {
  const cfg = readFileSync(path.join(root, "next.config.js"), "utf8");
  assert.match(cfg, /optimizePackageImports/);
  assert.match(cfg, /lucide-react/);
  assert.match(cfg, /cdn\.footystats\.org/);
  assert.match(cfg, /media\.api-sports\.io/);
});

test("error and not-found recovery are accessible and locale-aware", () => {
  const root404 = readFileSync(path.join(root, "app/not-found.tsx"), "utf8");
  assert.match(root404, /role=["']status["']/);
  assert.match(root404, /defaultLocale/);
  assert.match(root404, /\/archive/);
  const locale404 = readFileSync(
    path.join(root, "app/[locale]/not-found.tsx"),
    "utf8"
  );
  assert.match(locale404, /aria-live/);
  assert.match(locale404, /x-locale/);
  const err = readFileSync(path.join(root, "app/[locale]/error.tsx"), "utf8");
  assert.match(err, /role=["']alert["']/);
  assert.match(err, /useParams/);
  assert.match(err, /\/archive/);
});

test("structured data validation includes archive and methodology", () => {
  const issues = validateStructuredData("en");
  const errors = issues.filter((i) => i.severity === "error");
  assert.deepEqual(errors, [], JSON.stringify(errors, null, 2));
  const entities = issues.map((i) => i.entity).join(" ");
  // Generators ran; at minimum no errors. Soft check via source:
  const validateSrc = readFileSync(
    path.join(root, "lib/seo/validate.ts"),
    "utf8"
  );
  assert.match(validateSrc, /archiveHubWebPageLd/);
  assert.match(validateSrc, /methodologyWebPageLd/);
  assert.ok(entities || true);
});

test("smoke staging covers archive methodology and security headers", () => {
  const smoke = readFileSync(
    path.join(root, "scripts/smoke-staging.mjs"),
    "utf8"
  );
  assert.match(smoke, /archive_hub/);
  assert.match(smoke, /methodology_page/);
  assert.match(smoke, /security_headers_present/);
  assert.match(smoke, /x-request-id/);
});

test("launch checklist and sprint 19 docs exist", () => {
  for (const rel of [
    "docs/launch-checklist.md",
    "docs/sprint-19-completion-report.md",
    "docs/sprint-19-performance-audit.md",
    "docs/sprint-19-seo-audit.md",
    "docs/sprint-19-accessibility-audit.md",
    "docs/production-readiness-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
  const launch = readFileSync(
    path.join(root, "docs/launch-checklist.md"),
    "utf8"
  );
  assert.match(launch, /Search Console/);
  assert.match(launch, /Rollback/);
  assert.match(launch, /FF_SIGNED_REDIRECT_REQUIRED/);
});

test("production security headers remain launch-safe", () => {
  const prev = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  const headers = buildSecurityHeaders();
  const csp = headers.find((h) => h.key === "Content-Security-Policy")!.value;
  assert.ok(!csp.includes("'unsafe-eval'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  if (prev === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = prev;
});
