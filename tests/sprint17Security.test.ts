import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getFeatureFlags,
  publicFeatureFlags,
} from "../lib/config/featureFlags";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { isInsecureSecret, validateRuntimeEnv } from "../lib/config/env";
import {
  signRedirectContext,
  verifyRedirectToken,
} from "../lib/operators/redirect-token";
import { buildSecurityHeaders } from "../lib/security/headers";
import { evaluateDiagnosticsAccess } from "../lib/security/diagnosticsAccess";
import { BODY_LIMITS, readJsonBody } from "../lib/security/requestLimits";
import { pageMetadata } from "../lib/seo";

test("feature flags: production defaults are conservative", () => {
  const flags = getFeatureFlags({
    APP_ENV: "production",
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv);
  assert.equal(flags.developerDiagnosticsEnabled, false);
  assert.equal(flags.internalCronEnabled, false);
  assert.equal(flags.postbackIngestionEnabled, false);
  assert.equal(flags.stagingBannerVisible, false);
});

test("feature flags: unknown values fail safely; emergency disable works", () => {
  const flags = getFeatureFlags({
    APP_ENV: "production",
    FF_COMBO_ROUTE_ENABLED: "maybe",
    FF_EMERGENCY_DISABLE_COMBO: "true",
  } as NodeJS.ProcessEnv);
  assert.equal(flags.comboRouteEnabled, false);
  assert.equal(flags.comboHomepageVisible, false);
  const pub = publicFeatureFlags({ APP_ENV: "staging" } as NodeJS.ProcessEnv);
  assert.equal(typeof pub.stagingBannerVisible, "boolean");
});

test("redirect token rotation: active signs; previous verifies", () => {
  const prev = {
    AFFILIATE_REDIRECT_SECRET: process.env.AFFILIATE_REDIRECT_SECRET,
    AFFILIATE_REDIRECT_PREVIOUS_SECRET:
      process.env.AFFILIATE_REDIRECT_PREVIOUS_SECRET,
  };
  try {
    process.env.AFFILIATE_REDIRECT_SECRET = "active-secret-value-123456";
    process.env.AFFILIATE_REDIRECT_PREVIOUS_SECRET = "previous-secret-value-999";
    const token = signRedirectContext({ operatorId: "1xbet", placement: "test" });
    assert.ok(token.startsWith("r2."));
    assert.equal(verifyRedirectToken(token, "1xbet").ok, true);

    // Simulate rotated deploy: old token signed with previous as active
    process.env.AFFILIATE_REDIRECT_SECRET = "previous-secret-value-999";
    delete process.env.AFFILIATE_REDIRECT_PREVIOUS_SECRET;
    const oldToken = signRedirectContext({
      operatorId: "1xbet",
      placement: "legacy",
    });
    process.env.AFFILIATE_REDIRECT_SECRET = "active-secret-value-123456";
    process.env.AFFILIATE_REDIRECT_PREVIOUS_SECRET = "previous-secret-value-999";
    assert.equal(verifyRedirectToken(oldToken, "1xbet").ok, true);

    assert.equal(verifyRedirectToken("r9.abc.def.ghi", "1xbet").ok, false);
    assert.equal(
      verifyRedirectToken("r2.abc.def.ghi\n", "1xbet").ok,
      false
    );
    const expired = signRedirectContext({
      operatorId: "1xbet",
      ttlMs: 1,
      now: Date.now() - 10_000,
    });
    const exp = verifyRedirectToken(expired, "1xbet");
    assert.equal(exp.ok, false);
    if (!exp.ok) assert.equal(exp.reason, "expired");
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("security headers: prod omits unsafe-eval and preload by default", () => {
  const prev = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  const headers = buildSecurityHeaders();
  const csp = headers.find((h) => h.key === "Content-Security-Policy")!.value;
  assert.ok(!csp.includes("'unsafe-eval'"));
  assert.ok(csp.includes("object-src 'none'"));
  const hsts = headers.find((h) => h.key === "Strict-Transport-Security")!.value;
  assert.ok(!hsts.includes("preload"));
  if (prev === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = prev;
});

test("staging metadata and robots isolation helpers", () => {
  const prevApp = process.env.APP_ENV;
  const prevUrl = process.env.SITE_URL;
  process.env.APP_ENV = "staging";
  process.env.SITE_URL = "https://staging.rankwagers.com";
  const meta = pageMetadata({
    locale: "en",
    path: "/",
    title: "t",
    description: "d",
  });
  assert.deepEqual(meta.robots, { index: false, follow: false });
  assert.ok(String(meta.alternates?.canonical).includes("staging.rankwagers.com"));
  if (prevApp === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = prevApp;
  if (prevUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = prevUrl;
});

test("crawl/data-quality APIs require diagnostics access", () => {
  const root = path.resolve(__dirname, "..");
  const crawl = readFileSync(
    path.join(root, "app/api/crawl-quality/route.ts"),
    "utf8"
  );
  const data = readFileSync(
    path.join(root, "app/api/data-quality/route.ts"),
    "utf8"
  );
  assert.match(crawl, /requireDiagnosticsAccess/);
  assert.match(data, /requireDiagnosticsAccess/);
});

test("diagnostics reject query secrets in production", () => {
  const keys = [
    "APP_ENV",
    "NODE_ENV",
    "ENABLE_DIAGNOSTICS",
    "FF_DEVELOPER_DIAGNOSTICS_ENABLED",
    "DIAGNOSTICS_SECRET",
  ] as const;
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DIAGNOSTICS = "true";
    process.env.DIAGNOSTICS_SECRET = "diagnostics-secret-16+";
    const denied = evaluateDiagnosticsAccess({
      headers: new Headers(),
      searchParams: new URLSearchParams({ key: "diagnostics-secret-16+" }),
    });
    assert.equal(denied.allowed, false);
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
});

test("request body limits reject oversized and bad content-type", async () => {
  const badType = new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  const r1 = await readJsonBody(badType, BODY_LIMITS.comboApi);
  assert.equal(r1.ok, false);

  const oversized = new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(BODY_LIMITS.comboApi + 10),
    },
    body: "{}",
  });
  const r2 = await readJsonBody(oversized, BODY_LIMITS.comboApi);
  assert.equal(r2.ok, false);

  const ok = new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ a: 1 }),
  });
  const r3 = await readJsonBody(ok, BODY_LIMITS.comboApi);
  assert.equal(r3.ok, true);
  if (r3.ok) assert.equal(r3.body.a, 1);
});

test("env rejects insecure secrets without echoing values", () => {
  assert.equal(isInsecureSecret("admin"), true);
  assert.equal(isInsecureSecret("short"), true);
  const result = validateRuntimeEnv({
    APP_ENV: "staging",
    NODE_ENV: "production",
    SITE_URL: "https://staging.rankwagers.com",
    ADMIN_KEY: "admin",
    AFFILIATE_REDIRECT_SECRET: "dev-only-redirect-secret-change-me",
  } as NodeJS.ProcessEnv);
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes("dev-only-redirect"));
});
