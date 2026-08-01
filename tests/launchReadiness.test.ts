import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateLaunchReadiness,
  isLaunchableOrigin,
  summarise,
  FLOW_GATING_FLAGS,
  type LaunchProbe,
} from "../lib/launch/readiness";

/**
 * Sprint 37 — launch readiness register.
 *
 * The register's whole value is that it refuses to say "ready" on anything it has not observed, so
 * most of this suite is adversarial: it constructs the most optimistic probe it can and asserts
 * that the externally blocked conditions STILL do not pass.
 */

/** A probe where everything the repository controls is healthy. */
function healthyProbe(overrides: Partial<LaunchProbe> = {}): LaunchProbe {
  return {
    appEnv: "production",
    siteUrl: "https://rankwagers.com",
    weakOrMissingSecrets: [],
    bootValidationWired: true,
    flags: Object.fromEntries(FLOW_GATING_FLAGS.map((f) => [f.flag, true])),
    instanceCount: 1,
    multiInstanceWarningWired: true,
    postgresStructureVerified: true,
    postgresRuntimeExecuted: false,
    productionBuildExecuted: false,
    stagingSmokeExecuted: false,
    releaseScripts: { "build-verify.mjs": true, "smoke-staging.mjs": true },
    ...overrides,
  };
}

const byId = (probe: LaunchProbe, id: string) => {
  const r = evaluateLaunchReadiness(probe).find((x) => x.id === id);
  assert.ok(r, `condition ${id} is missing from the register`);
  return r;
};

/* ================================================================== *
 * 1. Blocked never becomes pass
 * ================================================================== */

test("structural PostgreSQL verification does NOT satisfy runtime validation", () => {
  /*
   * The most important assertion in this file. Reading the adapter's SQL proves shape, not
   * behaviour, and seven sprints of reports have had to repeat that by hand. Encoded here so a
   * future change that conflates the two fails a test instead of shipping a false claim.
   */
  const probe = healthyProbe({ postgresStructureVerified: true, postgresRuntimeExecuted: false });
  assert.equal(byId(probe, "db.postgres-adapter-structure").status, "pass");
  assert.equal(byId(probe, "db.postgres-runtime-validated").status, "blocked");
});

test("an otherwise perfect repository is still not launchable", () => {
  // Everything the repo controls is green; the three external conditions remain unmet.
  const results = evaluateLaunchReadiness(healthyProbe());
  const summary = summarise(results);
  assert.equal(summary.fail, 0, "no repo-controlled condition should be failing in this probe");
  assert.ok(summary.blocked >= 3, `expected at least 3 blocked, got ${summary.blocked}`);
  assert.equal(summary.launchable, false, "blocked conditions must prevent a launchable verdict");
});

test("launchable requires zero failures AND zero blocked", () => {
  const everything = healthyProbe({
    postgresRuntimeExecuted: true,
    productionBuildExecuted: true,
    stagingSmokeExecuted: true,
  });
  assert.equal(summarise(evaluateLaunchReadiness(everything)).launchable, true);

  // One blocked item is enough to withhold the verdict.
  const oneShort = healthyProbe({
    postgresRuntimeExecuted: true,
    productionBuildExecuted: true,
    stagingSmokeExecuted: false,
  });
  assert.equal(summarise(evaluateLaunchReadiness(oneShort)).launchable, false);
});

test("every blocked condition explains what would unblock it", () => {
  const blocked = evaluateLaunchReadiness(healthyProbe()).filter((r) => r.status === "blocked");
  assert.ok(blocked.length > 0);
  for (const r of blocked) {
    assert.ok(r.blocker, `${r.id} is blocked but names no blocker`);
    assert.ok(r.blocker.requires.length > 5, `${r.id}: blocker.requires is not descriptive`);
    assert.ok(r.blocker.unblockedWhen.length > 5, `${r.id}: blocker.unblockedWhen is not actionable`);
  }
});

/* ================================================================== *
 * 2. The false-green bug this sprint found
 * ================================================================== */

test("REGRESSION: an unresolved flag is a failure, not an implied pass", () => {
  /*
   * The first version tested `flags[name] === false`, so a flag that failed to resolve came back
   * `undefined`, matched nothing, and the register reported "no flow-gating flag is off" while
   * `operatorApprovalEnabled` was gating the entire Acca chain. The probe below reproduces that
   * exact shape.
   */
  const r = byId(healthyProbe({ flags: {} }), "flags.no-unintended-dark-flows");
  assert.equal(r.status, "fail");
  assert.match(r.detail, /could not be resolved/i);
});

test("a dark flow fails and names the flow, not just the flag", () => {
  const flags = Object.fromEntries(FLOW_GATING_FLAGS.map((f) => [f.flag, true]));
  flags.operatorApprovalEnabled = false;
  const r = byId(healthyProbe({ flags }), "flags.no-unintended-dark-flows");
  assert.equal(r.status, "fail");
  assert.match(r.detail, /operatorApprovalEnabled/);
  assert.match(r.detail, /Acca publication chain/i, "the report must say what goes dark, not just which flag");
});

test("all flags on is a pass", () => {
  assert.equal(byId(healthyProbe(), "flags.no-unintended-dark-flows").status, "pass");
});

/* ================================================================== *
 * 3. Origin validation
 * ================================================================== */

test("only a real HTTPS origin counts as launchable", () => {
  for (const bad of [
    null,
    "",
    "not a url",
    "http://rankwagers.com",
    "https://localhost:3000",
    "https://127.0.0.1",
    "https://example.com",
    "https://www.your-domain.com",
    "http://localhost:3000",
  ]) {
    assert.equal(isLaunchableOrigin(bad), false, `must be rejected: ${bad}`);
  }
  for (const good of ["https://rankwagers.com", "https://www.rankwagers.com/"]) {
    assert.equal(isLaunchableOrigin(good), true, `must be accepted: ${good}`);
  }
});

test("the current localhost configuration is reported as blocked, not failed", () => {
  // It is a missing input, not a defect in the repository — the distinction drives the checklist.
  const r = byId(healthyProbe({ siteUrl: "http://localhost:3000" }), "env.public-origin-is-real");
  assert.equal(r.status, "blocked");
});

/* ================================================================== *
 * 4. Durability limits are stated, not silently passed
 * ================================================================== */

test("the memory-only durability limitation is recorded even when the condition passes", () => {
  const r = byId(healthyProbe(), "durability.memory-only-limits-documented");
  assert.equal(r.status, "pass");
  assert.ok(r.limitation, "a passing durability check must still carry its limitation");
  assert.match(r.limitation, /process-local/i);
  assert.match(r.limitation, /idempotency/i);
});

test("the PostgreSQL structural pass carries its limitation too", () => {
  const r = byId(healthyProbe(), "db.postgres-adapter-structure");
  assert.equal(r.status, "pass");
  assert.match(r.limitation ?? "", /shape, not behaviour/i);
});

test("multi-instance deployment fails while limiters are memory-only", () => {
  const r = byId(healthyProbe({ instanceCount: 4 }), "durability.single-instance-deployment");
  assert.equal(r.status, "fail");
  assert.match(r.detail, /per-process/i);
});

/* ================================================================== *
 * 5. Environment
 * ================================================================== */

test("weak or missing secrets fail and are named", () => {
  const r = byId(healthyProbe({ weakOrMissingSecrets: ["ADMIN_KEY"] }), "env.secrets-present-and-strong");
  assert.equal(r.status, "fail");
  assert.match(r.detail, /ADMIN_KEY/);
});

test("unwiring boot validation is a failure", () => {
  const r = byId(healthyProbe({ bootValidationWired: false }), "env.boot-validation-wired");
  assert.equal(r.status, "fail");
});

/* ================================================================== *
 * 6. The checklist
 * ================================================================== */

test("the checklist leads with the origin, which unblocks the most downstream work", () => {
  // The origin has to actually be missing for it to head the list — this is today's real state.
  const summary = summarise(
    evaluateLaunchReadiness(healthyProbe({ siteUrl: "http://localhost:3000" })),
  );
  assert.ok(summary.checklist.length > 0);
  assert.match(summary.checklist[0], /HTTPS domain/i);
  // And the build, which depends on it, must come after.
  const buildAt = summary.checklist.findIndex((c) => /npm run build/i.test(c));
  assert.ok(buildAt > 0, "the production build must not lead the checklist ahead of its own input");
});

test("with the origin already valid, the database becomes the head of the checklist", () => {
  const summary = summarise(evaluateLaunchReadiness(healthyProbe()));
  assert.match(summary.checklist[0], /PostgreSQL/i);
});

test("external and repo items are distinguishable and repo items come last", () => {
  const probe = healthyProbe({ weakOrMissingSecrets: ["ADMIN_KEY"] });
  const { checklist } = summarise(evaluateLaunchReadiness(probe));
  const firstRepo = checklist.findIndex((c) => c.startsWith("[repo]"));
  const lastExternal = checklist.map((c) => c.startsWith("[external]")).lastIndexOf(true);
  assert.ok(firstRepo > lastExternal, "repo-fixable items must sort after external blockers");
});

test("a fully green probe produces an empty checklist", () => {
  const everything = healthyProbe({
    postgresRuntimeExecuted: true,
    productionBuildExecuted: true,
    stagingSmokeExecuted: true,
  });
  assert.deepEqual(summarise(evaluateLaunchReadiness(everything)).checklist, []);
});

/* ================================================================== *
 * 7. Register integrity
 * ================================================================== */

test("every condition is fully described", () => {
  for (const r of evaluateLaunchReadiness(healthyProbe())) {
    assert.ok(r.id.includes("."), `${r.id} should be namespaced`);
    assert.ok(r.title.length > 10, `${r.id} has no usable title`);
    assert.ok(r.evidence.length > 5, `${r.id} does not say what proves it`);
    assert.ok(r.detail.length > 10, `${r.id} has no actionable detail`);
    assert.ok(["pass", "fail", "blocked"].includes(r.status));
  }
});

test("condition ids are unique", () => {
  const ids = evaluateLaunchReadiness(healthyProbe()).map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate condition id");
});

test("the register covers every required category", () => {
  const categories = new Set(evaluateLaunchReadiness(healthyProbe()).map((r) => r.category));
  for (const required of ["environment", "feature-flags", "durability", "database", "build", "staging"]) {
    assert.ok(categories.has(required as never), `no condition covers ${required}`);
  }
});

test("evaluation is pure — the same probe yields the same result", () => {
  const probe = healthyProbe();
  assert.deepEqual(evaluateLaunchReadiness(probe), evaluateLaunchReadiness(probe));
});

test("missing release tooling is reported per script", () => {
  const probe = healthyProbe({ releaseScripts: { "smoke-staging.mjs": false } });
  const r = byId(probe, "build.script-present.smoke-staging.mjs");
  assert.equal(r.status, "fail");
});
