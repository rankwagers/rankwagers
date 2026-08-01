import assert from "node:assert/strict";
import test from "node:test";
import {
  EnvConfigError,
  resolveSiteUrl,
  validateRuntimeEnv,
  assertRuntimeEnvOrThrow,
} from "../lib/config/env";
import { evaluateDiagnosticsAccess } from "../lib/security/diagnosticsAccess";
import { memoryRateLimiter, getRateLimiter } from "../lib/security/rateLimit";
import {
  consoleMonitoringProvider,
  getMonitoring,
  resetMonitoringProvider,
} from "../lib/monitoring/provider";
import { buildReadinessReport } from "../lib/monitoring/health";
import { createAffiliateClick, resetAttributionStore } from "../lib/combo/attribution";

test("SITE_URL defaults to localhost outside deployed envs", () => {
  const origin = resolveSiteUrl({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
  assert.equal(origin, "http://localhost:3000");
});

test("SITE_URL rejects example.com and missing production value", () => {
  assert.throws(
    () =>
      resolveSiteUrl({
        NODE_ENV: "production",
        APP_ENV: "production",
        SITE_URL: "https://example.com",
      } as NodeJS.ProcessEnv),
    EnvConfigError
  );
  assert.throws(
    () =>
      resolveSiteUrl({
        NODE_ENV: "production",
        APP_ENV: "production",
      } as NodeJS.ProcessEnv),
    /SITE_URL is required/
  );
  assert.throws(
    () =>
      resolveSiteUrl({
        NODE_ENV: "production",
        APP_ENV: "staging",
        SITE_URL: "http://staging.example.org",
      } as NodeJS.ProcessEnv),
    /https/
  );
});

test("production env validation requires strong secrets", () => {
  const result = validateRuntimeEnv({
    NODE_ENV: "production",
    APP_ENV: "production",
    SITE_URL: "https://rankwagers.com",
    ADMIN_KEY: "admin",
    AFFILIATE_REDIRECT_SECRET: "dev-only-redirect-secret-change-me",
  } as NodeJS.ProcessEnv);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /ADMIN_KEY/.test(e)));
  assert.ok(result.errors.some((e) => /AFFILIATE_REDIRECT_SECRET/.test(e)));

  assert.throws(
    () =>
      assertRuntimeEnvOrThrow({
        NODE_ENV: "production",
        APP_ENV: "production",
        SITE_URL: "https://rankwagers.com",
      } as NodeJS.ProcessEnv),
    EnvConfigError
  );
});

test("diagnostics access: open in development, gated in production", () => {
  const keys = [
    "NODE_ENV",
    "APP_ENV",
    "ENABLE_DIAGNOSTICS",
    "ENABLE_DEVELOPER_TOOLS",
    "FF_DEVELOPER_DIAGNOSTICS_ENABLED",
    "DIAGNOSTICS_SECRET",
    "ADMIN_KEY",
  ] as const;
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.NODE_ENV = "development";
    delete process.env.APP_ENV;
    assert.equal(
      evaluateDiagnosticsAccess({ headers: new Headers() }).allowed,
      true
    );

    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "production";
    delete process.env.ENABLE_DIAGNOSTICS;
    delete process.env.ENABLE_DEVELOPER_TOOLS;
    const disabled = evaluateDiagnosticsAccess({ headers: new Headers() });
    assert.equal(disabled.allowed, false);
    if (!disabled.allowed) assert.equal(disabled.status, 404);

    process.env.ENABLE_DIAGNOSTICS = "true";
    process.env.FF_DEVELOPER_DIAGNOSTICS_ENABLED = "true";
    process.env.DIAGNOSTICS_SECRET = "super-secret-diagnostics-key";
    const unauthorized = evaluateDiagnosticsAccess({ headers: new Headers() });
    assert.equal(unauthorized.allowed, false);
    if (!unauthorized.allowed) assert.equal(unauthorized.status, 403);

    // Query-string secrets rejected in production
    const queryRejected = evaluateDiagnosticsAccess({
      headers: new Headers(),
      searchParams: new URLSearchParams({
        key: "super-secret-diagnostics-key",
      }),
    });
    assert.equal(queryRejected.allowed, false);

    const ok = evaluateDiagnosticsAccess({
      headers: new Headers({ "x-diagnostics-key": "super-secret-diagnostics-key" }),
    });
    assert.equal(ok.allowed, true);
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
});

test("rate limiter exposes swappable interface; monitoring defaults to console", () => {
  assert.equal(getRateLimiter(), memoryRateLimiter);
  assert.equal(getMonitoring().name, "console");
  resetMonitoringProvider();
  assert.equal(getMonitoring(), consoleMonitoringProvider);
});

test("readiness report includes required check names", async () => {
  const report = await buildReadinessReport({
    version: "test",
    now: Date.parse("2026-07-25T00:00:00.000Z"),
  });
  const names = report.checks.map((c) => c.name);
  for (const required of [
    "env",
    "site_url",
    "db",
    "migration",
    "signing_secret",
    "active_snapshot",
    "providers",
    "attribution_store",
  ]) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
});

test("attribution write failure still returns ephemeral click (redirect-safe)", async () => {
  resetAttributionStore();
  const failing = {
    async createClick() {
      throw new Error("db down");
    },
    async getClick() {
      return null;
    },
    async createConversion() {
      throw new Error("db down");
    },
    async listConversions() {
      return [];
    },
    async purgeExpired() {
      return 0;
    },
    async stats() {
      return {
        clickCount: 0,
        conversionCount: 0,
        attributedConversions: 0,
        unattributedConversions: 0,
        adapter: "failing",
      };
    },
  };
  const { setAttributionStore } = await import("../lib/combo/attribution");
  setAttributionStore(failing);
  const result = await createAffiliateClick({
    operatorId: "1xbet",
    locale: "en",
    placement: "test",
    availability: "unknown",
    deeplinkType: "homepage",
  });
  assert.equal(result.created, false);
  assert.ok(result.record.clickId.startsWith("clk_"));
  resetAttributionStore();
});
