import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";

// monitor-logic is CommonJS (loadable by both the .mjs monitor and this tsx test).
const requireCjs = createRequire(path.join(__dirname, "loader.cjs"));
const logic = requireCjs(path.resolve(__dirname, "../scripts/ops/monitor-logic.cjs"));

const okBody = { status: "ok", checks: [{ name: "db", status: "ok" }, { name: "odds_history", status: "ok" }] };

/* ---------------- RF-1: readiness-aware paging ---------------- */

test("RF-1 healthy: liveness 200 + readiness all-ok → no page, ok", () => {
  const d = logic.decide([logic.classifyLiveness(200), logic.classifyReadiness(200, okBody)]);
  assert.equal(d.paging, false);
  assert.equal(d.ok, true);
});

test("RF-1 serving but degraded: optional readiness check degraded → WARN, not paging", () => {
  const body = { status: "degraded", checks: [{ name: "db", status: "ok" }, { name: "analytics", status: "degraded" }] };
  const readiness = logic.classifyReadiness(503, body);
  assert.equal(readiness.severity, "warn");
  const d = logic.decide([logic.classifyLiveness(200), readiness]);
  assert.equal(d.paging, false); // site serving; degradation is known/optional
  assert.equal(d.ok, false); // but surfaced as degraded
});

test("RF-1 genuine outage: liveness non-200 and unreachable → PAGE", () => {
  assert.equal(logic.classifyLiveness(502).severity, "page");
  assert.equal(logic.classifyLiveness("error:AbortError").severity, "page");
  assert.equal(logic.classifyLiveness("error:AbortError").reason, logic.REASON.APP_UNREACHABLE);
  const d = logic.decide([logic.classifyLiveness(503), logic.classifyReadiness(200, okBody)]);
  assert.equal(d.paging, true);
});

test("RF-1 DB failure: persistence readiness check failing → PAGE", () => {
  const body = { status: "fail", checks: [{ name: "db", status: "fail" }, { name: "analytics", status: "ok" }] };
  const readiness = logic.classifyReadiness(503, body);
  assert.equal(readiness.severity, "page");
  assert.equal(readiness.reason, logic.REASON.PERSISTENCE_DEGRADED);
  assert.deepEqual(readiness.detail.failing, ["db"]);
  const d = logic.decide([logic.classifyLiveness(200), readiness]);
  assert.equal(d.paging, true);
});

test("RF-1 expected optional feature OFF (raw provider archive OFF analog) → non-paging", () => {
  // A degraded optional/known dependency (not a persistence check) must NOT page.
  const body = { status: "degraded", checks: [{ name: "providers", status: "degraded" }, { name: "db", status: "ok" }] };
  const readiness = logic.classifyReadiness(503, body);
  assert.equal(readiness.severity, "warn");
  assert.equal(logic.decide([logic.classifyLiveness(200), readiness]).paging, false);
});

test("RF-1 attribution_store degraded (accepted memory state) is NON-paging", () => {
  // Live state: attribution still memory. Known/optional degradation → WARN, never a page.
  const body = { status: "degraded", checks: [{ name: "attribution_store", status: "degraded" }, { name: "db", status: "ok" }, { name: "odds_history", status: "ok" }, { name: "provider_snapshots", status: "ok" }] };
  const readiness = logic.classifyReadiness(503, body);
  assert.equal(readiness.severity, "warn");
  assert.equal(readiness.reason, logic.REASON.READINESS_OPTIONAL_DEGRADED);
  assert.equal(logic.decide([logic.classifyLiveness(200), readiness]).paging, false);
});

test("RF-1 malformed health response → WARN, not paging (liveness governs serving)", () => {
  assert.equal(logic.classifyReadiness(200, null).severity, "warn");
  assert.equal(logic.classifyReadiness(200, null).reason, logic.REASON.READINESS_MALFORMED);
  assert.equal(logic.classifyReadiness(200, { garbage: true }).severity, "warn");
  assert.equal(logic.classifyReadiness("error:fetch", null).reason, logic.REASON.READINESS_UNREACHABLE);
  const d = logic.decide([logic.classifyLiveness(200), logic.classifyReadiness(200, null)]);
  assert.equal(d.paging, false);
});

/* ---------------- RF-2: authoritative aff-site restart-delta ---------------- */

const affOnline = (restart: number, unstable = 0) => ({
  name: "aff-site",
  pm2_env: { status: "online", restart_time: restart, unstable_restarts: unstable },
});

test("RF-2 historic restart count alone does NOT page (delta 0; first run prev=null)", () => {
  // Lifetime 167591 but no new restarts since last window → OK.
  assert.equal(logic.classifyPm2([affOnline(167591)], 167591, 5, "aff-site").severity, "ok");
  // First run (prev=null) also ignores the historic count.
  assert.equal(logic.classifyPm2([affOnline(167591)], null, 5, "aff-site").severity, "ok");
});

test("RF-2 new restart delta within the window pages", () => {
  const c = logic.classifyPm2([affOnline(20)], 10, 5, "aff-site"); // delta 10 > 5
  assert.equal(c.severity, "page");
  assert.equal(c.reason, logic.REASON.PM2_RESTART_CHURN);
  assert.equal(c.detail.delta, 10);
});

test("RF-2 stopped obsolete rankdev app is ignored", () => {
  const apps = [affOnline(5), { name: "rankwagers", pm2_env: { status: "stopped", restart_time: 167591, unstable_restarts: 0 } }];
  const c = logic.classifyPm2(apps, 5, 5, "aff-site");
  assert.equal(c.severity, "ok"); // rankwagers never selected; aff-site delta 0
  assert.equal(c.detail.delta, 0);
});

test("RF-2 aff-site missing or offline pages", () => {
  const missing = logic.classifyPm2([{ name: "rankwagers", pm2_env: { status: "stopped" } }], 0, 5, "aff-site");
  assert.equal(missing.severity, "page");
  assert.equal(missing.reason, logic.REASON.PM2_APP_MISSING);
  const offline = logic.classifyPm2([{ name: "aff-site", pm2_env: { status: "stopped" } }], 0, 5, "aff-site");
  assert.equal(offline.severity, "page");
  assert.equal(offline.reason, logic.REASON.PM2_APP_OFFLINE);
});

/* ---------------- alert payload: bounded, secret-free ---------------- */

test("alert payload carries only bounded reason codes + whitelisted detail (no secrets/raw payload)", () => {
  const readiness = logic.classifyReadiness(503, { checks: [{ name: "db", status: "fail" }] });
  const churn = logic.classifyPm2([affOnline(30)], 10, 5, "aff-site");
  const decision = logic.decide([logic.classifyLiveness(200), readiness, churn]);
  const alert = logic.buildAlert(decision, "2026-08-01T00:00:00.000Z");
  assert.ok(alert.text.includes("persistence_degraded"));
  for (const f of alert.failing) {
    assert.deepEqual(Object.keys(f).sort(), ["detail", "name", "reason"]);
    // detail keys must be within the bounded whitelist
    for (const k of Object.keys(f.detail)) {
      assert.ok(["status", "ageH", "maxH", "delta", "unstable", "maxDelta", "app", "failing"].includes(k), `unbounded key ${k}`);
    }
  }
  const serialized = JSON.stringify(alert);
  assert.ok(!/postgres:\/\//.test(serialized), "no connection string in alert");
  assert.ok(!/password/i.test(serialized), "no secret in alert");
});

test("boundedDetail strips unknown/high-cardinality keys", () => {
  const cleaned = logic.boundedDetail({ status: 503, url: "postgres://u:p@h/db", fixtureId: 12345, failing: ["db"] });
  assert.equal(cleaned.url, undefined);
  assert.equal(cleaned.fixtureId, undefined);
  assert.equal(cleaned.status, 503);
  assert.deepEqual(cleaned.failing, ["db"]);
});

test("backup/restore/cron freshness never pages (non-paging warns)", () => {
  assert.equal(logic.classifyBackup(false, null, Infinity, 26).severity, "warn"); // absent
  assert.equal(logic.classifyBackup(true, false, 100, 26).severity, "warn"); // stale
  assert.equal(logic.classifyBackup(true, true, 1, 26).severity, "ok");
  assert.equal(logic.classifyRestore(false, null, Infinity, 192).severity, "ok"); // optional
  assert.equal(logic.classifyCron(100, 30).severity, "warn"); // stale
  assert.equal(logic.classifyCron(1, 30).severity, "ok");
  const d = logic.decide([logic.classifyBackup(false, null, Infinity, 26), logic.classifyCron(100, 30)]);
  assert.equal(d.paging, false);
});
