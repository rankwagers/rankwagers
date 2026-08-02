import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * `active_snapshot` readiness semantics.
 *
 * Production served correctly — homepage, lists, qualified fixtures, top picks, sitemap — while
 * `/api/health/ready` returned 503 on `active_snapshot :: fail`. The cause was not a broken
 * dependency: the combo snapshot had never been produced, because its only producer
 * (`refreshComboPreparedSnapshot`, reachable solely through the cron routes) has no scheduler on
 * this deployment, and no product surface reads the snapshot.
 *
 * These tests pin the distinction that fix rests on — absent is dormant, invalid is broken — and
 * pin the structural facts that make "absent is dormant" true today. If a product surface ever
 * starts consuming the snapshot, the last test here fails and this decision gets revisited.
 */

const ROOT = path.resolve(__dirname, "..");
const HEALTH = readFileSync(path.join(ROOT, "lib/monitoring/health.ts"), "utf8");

/** Body of `activeSnapshotCheck`, isolated so assertions cannot match neighbouring checks. */
function activeSnapshotCheckBody(): string {
  const start = HEALTH.indexOf("async function activeSnapshotCheck");
  assert.ok(start > 0, "activeSnapshotCheck must exist");
  const next = HEALTH.indexOf("\nfunction ", start);
  return HEALTH.slice(start, next > 0 ? next : undefined);
}


/** Walk product sources, strip comments, and report files referencing any symbol. */
function scanCode(symbols: string[], allowed: string[]): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const rel = path.relative(ROOT, full);
      if (allowed.includes(rel)) continue;
      const code = readFileSync(full, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      if (symbols.some((sym) => code.includes(sym))) out.push(rel);
    }
  };
  for (const d of ["lib", "app", "components"]) walk(path.join(ROOT, d));
  return out.sort();
}

test("absent snapshot reports degraded, not fail", () => {
  const body = activeSnapshotCheckBody();
  const absent = body.indexOf("if (!active) {");
  assert.ok(absent > 0, "absent must be handled as its own branch");
  const branch = body.slice(absent, absent + 400);
  assert.match(branch, /status: isDeployedEnv\(\) \? "degraded" : "ok"/);
  assert.match(branch, /not produced/);
  // The detail must name the reason, so an operator is not left guessing.
  assert.match(branch, /no combo snapshot refresh is scheduled/);
});

test("invalid snapshot still reports fail — the fix does not blanket-soften the check", () => {
  const body = activeSnapshotCheckBody();
  const invalid = body.indexOf('if (active.status !== "valid")');
  assert.ok(invalid > 0, "invalid must be handled separately from absent");
  const branch = body.slice(invalid, invalid + 400);
  assert.match(branch, /status: isDeployedEnv\(\) \? "fail" : "degraded"/);
  assert.match(branch, /is not valid/);
});

test("expiry still reports fail", () => {
  const body = activeSnapshotCheckBody();
  assert.match(body, /if \(!isSnapshotUsable\(freshness\)\)/);
  const expiryIdx = body.indexOf("if (!isSnapshotUsable(freshness))");
  assert.match(body.slice(expiryIdx, expiryIdx + 260), /status: "fail"/);
  assert.match(body.slice(expiryIdx, expiryIdx + 260), /expired/);
});

test("stale-but-usable still reports degraded", () => {
  const body = activeSnapshotCheckBody();
  const staleIdx = body.indexOf('freshness === "stale_but_usable"');
  assert.ok(staleIdx > 0);
  assert.match(body.slice(staleIdx, staleIdx + 260), /status: "degraded"/);
});

test("absent and invalid are distinguishable in the emitted detail", () => {
  const body = activeSnapshotCheckBody();
  // The pre-fix collapse — one message for both states — must not return.
  assert.doesNotMatch(body, /!active \|\| active\.status !== "valid"/);
  assert.doesNotMatch(body, /"no valid active combo_prepared snapshot"/);
});

test("no other readiness check was softened by this change", () => {
  // Every check that reported `fail` before must still be able to report `fail`.
  for (const symbol of [
    "siteUrlCheck",
    "envCheck",
    "signingSecretCheck",
    "migrationCheck",
    "diagnosticsSafetyCheck",
  ]) {
    const idx = HEALTH.indexOf(`function ${symbol}`);
    assert.ok(idx > 0, `${symbol} must exist`);
    const next = HEALTH.indexOf("\nfunction ", idx);
    const body = HEALTH.slice(idx, next > 0 ? next : undefined);
    assert.match(body, /status: "fail"|\? "fail"/, `${symbol} must retain a fail path`);
  }
  // The daily-lists fallback check from the previous release is untouched.
  assert.match(HEALTH, /function dailyListsCheck/);
  assert.match(HEALTH, /serving_stale/);
});

test("the premise holds: no product surface consumes the combo snapshot", () => {
  // If this fails, the snapshot has become operationally required and "absent is dormant" — the
  // entire basis of the degraded classification — no longer holds.
  //
  // Scans CODE only: prose in a comment naming the symbol is documentation, not consumption.
  const offenders = scanCode(["resolveComboClientSnapshot", "loadActiveComboSnapshot"], [
    "lib/snapshots/refresh.ts",
  ]);
  assert.deepEqual(
    offenders,
    [],
    `combo snapshot gained a product consumer — revisit the readiness classification:\n${offenders.join("\n")}`
  );
});

test("the producer is still reachable only through the cron routes", () => {
  const offenders = scanCode(["refreshComboPreparedSnapshot"], [
    "lib/snapshots/refresh.ts",
    "lib/jobs/runner.ts",
  ]);
  assert.deepEqual(
    offenders,
    [],
    `producer gained a new call site — the dormancy premise must be re-verified:\n${offenders.join("\n")}`
  );
});
