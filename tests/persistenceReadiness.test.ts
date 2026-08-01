import assert from "node:assert/strict";
import test from "node:test";
import {
  providerSnapshotStoreCheck,
  buildReadinessReport,
} from "../lib/monitoring/health";

const PERSISTENCE_ENV_KEYS = [
  "SNAPSHOT_ADAPTER",
  "SNAPSHOT_DATABASE_URL",
  "ATTRIBUTION_DATABASE_URL",
  "ODDS_HISTORY_DATABASE_URL",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof PERSISTENCE_ENV_KEYS)[number], string | undefined>>,
  fn: () => void
): void {
  const saved: Record<string, string | undefined> = {};
  for (const key of PERSISTENCE_ENV_KEYS) saved[key] = process.env[key];
  try {
    for (const key of PERSISTENCE_ENV_KEYS) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of PERSISTENCE_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("provider_snapshots readiness: memory fallback when no database url", () => {
  withEnv({}, () => {
    const check = providerSnapshotStoreCheck();
    assert.equal(check.name, "provider_snapshots");
    assert.equal(check.status, "degraded");
    assert.match(check.detail ?? "", /memory fallback/);
  });
});

test("provider_snapshots readiness: postgres when SNAPSHOT_DATABASE_URL set", () => {
  withEnv({ SNAPSHOT_DATABASE_URL: "postgres://user@127.0.0.1:5432/db" }, () => {
    const check = providerSnapshotStoreCheck();
    assert.equal(check.status, "ok");
    assert.equal(check.detail, "postgres configured");
  });
});

test("provider_snapshots readiness: falls back to ATTRIBUTION/ODDS_HISTORY url (mirrors store precedence)", () => {
  withEnv({ ATTRIBUTION_DATABASE_URL: "postgres://user@127.0.0.1:5432/db" }, () => {
    assert.equal(providerSnapshotStoreCheck().status, "ok");
  });
  withEnv({ ODDS_HISTORY_DATABASE_URL: "postgres://user@127.0.0.1:5432/db" }, () => {
    assert.equal(providerSnapshotStoreCheck().status, "ok");
  });
});

test("provider_snapshots readiness: SNAPSHOT_ADAPTER=memory forces degraded even with a url", () => {
  withEnv(
    {
      SNAPSHOT_ADAPTER: "memory",
      SNAPSHOT_DATABASE_URL: "postgres://user@127.0.0.1:5432/db",
    },
    () => {
      const check = providerSnapshotStoreCheck();
      assert.equal(check.status, "degraded");
      assert.match(check.detail ?? "", /SNAPSHOT_ADAPTER=memory/);
    }
  );
});

test("readiness check never emits a connection string", () => {
  withEnv(
    { SNAPSHOT_DATABASE_URL: "postgres://secret-user:secret-pass@db.internal:5432/x" },
    () => {
      const detail = providerSnapshotStoreCheck().detail ?? "";
      assert.ok(!detail.includes("secret-pass"));
      assert.ok(!detail.includes("db.internal"));
      assert.ok(!detail.includes("postgres://"));
    }
  );
});

test("readiness report includes both durable-store adapter checks", async () => {
  await withEnvAsync({}, async () => {
    const report = await buildReadinessReport({ version: "test" });
    const names = report.checks.map((c) => c.name);
    assert.ok(names.includes("odds_history"), "odds_history check present");
    assert.ok(names.includes("provider_snapshots"), "provider_snapshots check present");
  });
});

// async variant of withEnv for the report test (no DB url set → no connection attempted)
async function withEnvAsync(
  overrides: Partial<Record<(typeof PERSISTENCE_ENV_KEYS)[number], string | undefined>>,
  fn: () => Promise<void>
): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const key of PERSISTENCE_ENV_KEYS) saved[key] = process.env[key];
  try {
    for (const key of PERSISTENCE_ENV_KEYS) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fn();
  } finally {
    for (const key of PERSISTENCE_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}
