import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLaunchReadiness, FLOW_GATING_FLAGS } from "../lib/launch/readiness";
import {
  CHECKLIST_ORDER,
  CHECKLIST_TITLES,
  CONDITION_TO_ITEM,
  checklistProgress,
  evaluateChecklistConditions,
  launchChecklistV1,
  type ChecklistProbe,
} from "../lib/launch/checklist";

/**
 * Sprint 38 — Launch Checklist v1.
 *
 * Fifteen named items drive the release phase. The suite's job is to make sure a green tick means
 * something: that an item cannot pass while anything beneath it is unproven, and that the two
 * revenue-critical and safety-critical items in particular cannot be satisfied by the mere
 * presence of a file.
 */

function probe(overrides: Partial<ChecklistProbe> = {}): ChecklistProbe {
  return {
    // register surface
    appEnv: "production",
    siteUrl: "https://rankwagers.com",
    weakOrMissingSecrets: [],
    bootValidationWired: true,
    flags: {
      ...Object.fromEntries(FLOW_GATING_FLAGS.map((f) => [f.flag, true])),
      postbackIngestionEnabled: true,
    },
    instanceCount: 1,
    multiInstanceWarningWired: true,
    postgresStructureVerified: true,
    postgresRuntimeExecuted: true,
    productionBuildExecuted: true,
    stagingSmokeExecuted: true,
    releaseScripts: {},
    // checklist surface
    postbackVerificationWired: true,
    postbackAllowlistConfigured: true,
    robotsRoutePresent: true,
    stagingNoindexWired: true,
    sitemapRoutePresent: true,
    canonicalWired: true,
    structuredDataPresent: true,
    searchConsoleVerified: true,
    analyticsConfigured: true,
    errorLoggingWired: true,
    healthEndpointPresent: true,
    backupRehearsed: true,
    rollbackRehearsed: true,
    ...overrides,
  };
}

function checklistFor(p: ChecklistProbe) {
  return launchChecklistV1(evaluateLaunchReadiness(p), evaluateChecklistConditions(p));
}

const item = (p: ChecklistProbe, id: string) => {
  const found = checklistFor(p).find((i) => i.id === id);
  assert.ok(found, `checklist item ${id} is missing`);
  return found;
};

/* ================================================================== *
 * 1. Shape
 * ================================================================== */

test("the checklist has exactly the fifteen requested items, in order", () => {
  const items = checklistFor(probe());
  assert.equal(items.length, 15);
  assert.deepEqual(
    items.map((i) => i.title),
    [
      "PostgreSQL",
      "Production build",
      "HTTPS",
      "Feature flags",
      "Postback",
      "Robots",
      "Sitemap",
      "Canonical",
      "Structured Data",
      "Search Console",
      "Analytics",
      "Error logging",
      "Backup",
      "Rollback",
      "Monitoring",
    ],
  );
});

test("every item has at least one condition behind it", () => {
  // An item with no conditions would render as a tick nobody ever earned.
  for (const i of checklistFor(probe())) {
    assert.ok(i.conditions.length > 0, `${i.title} has no supporting condition`);
  }
});

test("every declared id has a title and a place in the order", () => {
  for (const id of CHECKLIST_ORDER) assert.ok(CHECKLIST_TITLES[id], `${id} has no title`);
  assert.equal(new Set(CHECKLIST_ORDER).size, CHECKLIST_ORDER.length, "duplicate item id");
});

test("every mapped register condition points at a real item", () => {
  for (const [conditionId, itemId] of Object.entries(CONDITION_TO_ITEM)) {
    assert.ok(CHECKLIST_ORDER.includes(itemId), `${conditionId} maps to unknown item ${itemId}`);
  }
});

/* ================================================================== *
 * 2. The roll-up rule
 * ================================================================== */

test("an item is green only when EVERY condition beneath it is green", () => {
  assert.equal(item(probe(), "postgresql").status, "pass");
  // One blocked sub-condition is enough to withhold the tick.
  assert.equal(item(probe({ postgresRuntimeExecuted: false }), "postgresql").status, "blocked");
});

test("a failure outranks a block, because a failure is actionable now", () => {
  /*
   * Postback is the case that motivated this rule. Its allowlist is externally blocked, but the
   * ingestion flag is a decision we can take today. If `blocked` won, the item would read as
   * "waiting on someone else" when in fact it is waiting on us.
   */
  const p = probe({
    postbackAllowlistConfigured: false,
    flags: { ...probe().flags, postbackIngestionEnabled: false },
  });
  assert.equal(item(p, "postback").status, "fail");
});

test("a fully healthy probe completes the whole checklist", () => {
  const items = checklistFor(probe());
  const notDone = items.filter((i) => i.status !== "pass").map((i) => i.title);
  assert.deepEqual(notDone, [], `expected all green, still open: ${notDone.join(", ")}`);
  assert.deepEqual(checklistProgress(items), { done: 15, total: 15, percent: 100 });
});

/* ================================================================== *
 * 3. Presence is not proof
 * ================================================================== */

test("Backup cannot be satisfied by the backup scripts existing", () => {
  /*
   * The scripts have been in the repo for many sprints. An untested backup is an assumption, and
   * the difference between the two is the entire value of the item.
   */
  const i = item(probe({ backupRehearsed: false }), "backup");
  assert.equal(i.status, "blocked");
  assert.match(i.conditions.find((c) => c.status === "blocked")!.detail, /NOT EXECUTED/);
});

test("Rollback cannot be satisfied by the rollback script existing", () => {
  const i = item(probe({ rollbackRehearsed: false }), "rollback");
  assert.equal(i.status, "blocked");
  assert.match(
    i.conditions.find((c) => c.status === "blocked")!.detail,
    /should not happen during the first incident/i,
  );
});

test("PostgreSQL cannot be satisfied by structural verification alone", () => {
  const i = item(probe({ postgresStructureVerified: true, postgresRuntimeExecuted: false }), "postgresql");
  assert.equal(i.status, "blocked");
  assert.ok(
    i.conditions.some((c) => c.status === "pass"),
    "the structural condition should still pass — the item is withheld by the runtime one",
  );
});

/* ================================================================== *
 * 4. Revenue
 * ================================================================== */

test("Postback fails when ingestion is off, and says why in revenue terms", () => {
  const p = probe({ flags: { ...probe().flags, postbackIngestionEnabled: false } });
  const i = item(p, "postback");
  assert.equal(i.status, "fail");
  const failing = i.conditions.find((c) => c.status === "fail")!;
  assert.match(failing.detail, /unattributable/i);
});

test("Postback fails if verification is not wired, regardless of the flag", () => {
  // An unauthenticated postback endpoint is worse than a disabled one.
  const i = item(probe({ postbackVerificationWired: false }), "postback");
  assert.equal(i.status, "fail");
  assert.match(i.conditions.find((c) => c.status === "fail")!.detail, /fabricate/i);
});

test("enabling ingestion does not claim to recover conversions missed while it was off", () => {
  const c = evaluateChecklistConditions(probe()).find((x) => x.id === "postback.ingestion-enabled");
  assert.match(c!.limitation ?? "", /lost, not queued/i);
});

/* ================================================================== *
 * 5. SEO items state their limits
 * ================================================================== */

test("Canonical records that its URLs are only as real as SITE_URL", () => {
  const c = evaluateChecklistConditions(probe()).find((x) => x.id === "seo.canonical-wired");
  assert.match(c!.limitation ?? "", /localhost/i);
});

test("Sitemap and Structured Data do not overclaim what presence proves", () => {
  const conditions = evaluateChecklistConditions(probe());
  assert.match(
    conditions.find((c) => c.id === "seo.sitemap-route")!.limitation ?? "",
    /only observable against a real build/i,
  );
  assert.match(
    conditions.find((c) => c.id === "seo.structured-data")!.limitation ?? "",
    /Validity against Google/i,
  );
});

test("Search Console is blocked behind domain ownership, not merely unfinished", () => {
  const i = item(probe({ searchConsoleVerified: false }), "search-console");
  assert.equal(i.status, "blocked");
  assert.match(i.conditions[0].blocker!.requires, /ownership of the production domain/i);
});

test("Robots covers staging noindex, not just the route existing", () => {
  const i = item(probe({ stagingNoindexWired: false }), "robots");
  assert.equal(i.status, "fail");
  assert.match(i.conditions.find((c) => c.status === "fail")!.detail, /split ranking signals/i);
});

/* ================================================================== *
 * 6. Operations
 * ================================================================== */

test("Monitoring records that nothing is polling the health endpoint", () => {
  const c = evaluateChecklistConditions(probe()).find((x) => x.id === "ops.health-endpoint");
  assert.equal(c!.status, "pass");
  assert.match(c!.limitation ?? "", /Nothing is polling it/i);
});

test("Analytics blocked means first traffic is unmeasured, and says so", () => {
  const i = item(probe({ analyticsConfigured: false }), "analytics");
  assert.equal(i.status, "blocked");
  assert.match(i.conditions[0].detail, /no backfill/i);
});

test("Error logging fails if process-level handlers are not wired", () => {
  const i = item(probe({ errorLoggingWired: false }), "error-logging");
  assert.equal(i.status, "fail");
});

/* ================================================================== *
 * 7. Determinism
 * ================================================================== */

test("the checklist is a pure function of the probe", () => {
  const p = probe();
  assert.deepEqual(checklistFor(p), checklistFor(p));
});

test("progress counts only completed items", () => {
  const p = probe({ postgresRuntimeExecuted: false, analyticsConfigured: false });
  const items = checklistFor(p);
  const progress = checklistProgress(items);
  assert.equal(progress.total, 15);
  assert.equal(progress.done, 13);
  assert.equal(progress.percent, 87);
});
