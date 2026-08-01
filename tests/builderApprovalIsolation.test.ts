import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { createMemoryCandidateStore } from "../lib/builder-approval/adapters/memory";
import { CANDIDATE_SCHEMA_VERSION } from "../lib/builder-approval/contracts";
import { defaultCandidateListFilters } from "../lib/builder-approval/filters";
import {
  getCandidateStore,
  resetCandidateStoreForTests,
  setCandidateStore,
  type CandidateStore,
} from "../lib/builder-approval/store";
import { resetRateLimitBuckets } from "../lib/security/rateLimit";
import * as publicRoute from "../app/api/acca/builder/route";
import * as adminRoute from "../app/api/admin/builder-approval/candidates/route";

/**
 * Sprint 20B-A runtime isolation verification — executed, not inspected.
 *
 * Module-graph coupling is measured in CHILD PROCESSES. Measuring it in-process is unsound:
 * esbuild hoists every top-level `require` to module load, so this file's own imports would
 * already have populated `require.cache` before any test body ran. Each child therefore
 * loads exactly ONE route and reports what that route actually pulled in.
 */

// Next's ambient types declare NODE_ENV readonly; the cast is type-level only.
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";
process.env.ADMIN_KEY = "isolation-admin-key-0123456789";
process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
delete process.env.SITE_URL;
delete process.env.BUILDER_APPROVAL_DATABASE_URL;

const ADMIN_KEY = "isolation-admin-key-0123456789";
const root = process.cwd();

/* ------------------------------------------------------------------ *
 * Child-process module-graph probe
 * ------------------------------------------------------------------ */

function probeModuleGraph(routeRelPath: string): string[] {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rw-graph-"));
  const probeFile = path.join(dir, "probe.cjs");
  const target = path.join(root, routeRelPath).replace(/\\/g, "\\\\");
  writeFileSync(
    probeFile,
    [
      `process.env.NODE_ENV = "test";`,
      `process.env.ADMIN_KEY = ${JSON.stringify(ADMIN_KEY)};`,
      `process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";`,
      `require("${target}");`,
      `const keys = Object.keys(require.cache)`,
      `  .map(function (k) { return k.replace(/\\\\/g, "/"); })`,
      `  .filter(function (k) { return k.indexOf("/lib/") >= 0 || k.indexOf("/app/") >= 0; });`,
      `console.log("__GRAPH__" + JSON.stringify(keys));`,
    ].join("\n"),
    "utf8",
  );

  const res = spawnSync(
    process.execPath,
    [
      "--require",
      path.join(root, "scripts/mock-server-only.cjs"),
      "--import",
      "tsx",
      probeFile,
    ],
    { cwd: root, encoding: "utf8", timeout: 120_000 },
  );

  assert.equal(
    res.status,
    0,
    `graph probe for ${routeRelPath} failed:\n${res.stdout}\n${res.stderr}`,
  );
  const line = (res.stdout || "")
    .split(/\r?\n/)
    .find((l) => l.startsWith("__GRAPH__"));
  assert.ok(line, `graph probe produced no output for ${routeRelPath}`);
  return JSON.parse(line.slice("__GRAPH__".length)) as string[];
}

const matching = (keys: string[], needle: string) => keys.filter((k) => k.includes(needle));

/* ------------------------------------------------------------------ *
 * 4. Route isolation — measured in isolated processes
 * ------------------------------------------------------------------ */

test("graph_public_builder_route_loads_zero_builder_approval_modules", () => {
  const keys = probeModuleGraph("app/api/acca/builder/route.ts");

  // Sanity: the child really did load the public Builder's own dependency graph.
  assert.ok(
    matching(keys, "lib/acca-builder/load.server").length > 0,
    `expected the Builder generation path to load; got ${keys.length} modules`,
  );

  // Zero coupling to Builder Approval.
  for (const needle of [
    "lib/builder-approval/",
    "lib/security/adminCsrf",
    "lib/security/adminAuth",
    "lib/security/requireAdminAccess",
    "app/api/admin/",
  ]) {
    assert.deepEqual(
      matching(keys, needle),
      [],
      `public Builder must not load ${needle}`,
    );
  }
});

test("graph_admin_route_loads_zero_builder_generation_modules", () => {
  const keys = probeModuleGraph("app/api/admin/builder-approval/candidates/route.ts");

  // Sanity: the child really did load the approval graph.
  assert.ok(
    matching(keys, "lib/builder-approval/service").length > 0,
    "expected the approval service to load",
  );

  // Zero coupling to Builder generation / providers.
  for (const needle of [
    "lib/acca-builder/",
    "lib/combo/prepare",
    "lib/combo/prepared",
    "lib/footystats/client",
    "app/api/acca/",
  ]) {
    assert.deepEqual(
      matching(keys, needle),
      [],
      `admin route must not load ${needle}`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * Runtime helpers
 * ------------------------------------------------------------------ */

let ipCounter = 0;
const nextIp = () => `10.7.${Math.floor(++ipCounter / 250) % 250}.${ipCounter % 250}`;

function publicBuilderRequest() {
  return new NextRequest("http://localhost:3000/api/acca/builder", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
    body: JSON.stringify({}),
  });
}

function adminCreateRequest(idempotencyKey: string) {
  return new NextRequest("http://localhost:3000/api/admin/builder-approval/candidates", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ADMIN_KEY}`,
      "idempotency-key": idempotencyKey,
      "x-forwarded-for": nextIp(),
    },
    body: JSON.stringify({
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      sourceRequestId: "req_isolation",
      sourceSnapshotId: "snap_isolation",
      sourceDate: "2026-07-26",
      sourceBuilderConfig: { locale: "en", riskMode: "balanced" },
      payload: {
        kind: "builder_combination",
        combination: {
          id: "combo_iso",
          legCount: 2,
          legs: [
            {
              id: "c1",
              matchId: 501,
              homeTeam: "Home FC",
              awayTeam: "Away FC",
              competition: "Test League",
              kickoffAt: "2026-07-27T18:00:00.000Z",
              marketKey: "over25",
              confidence: 70,
              odds: 1.7,
            },
            {
              id: "c2",
              matchId: 502,
              homeTeam: "Home2 FC",
              awayTeam: "Away2 FC",
              competition: "Test League",
              kickoffAt: "2026-07-27T20:00:00.000Z",
              marketKey: "over15",
              confidence: 75,
              odds: 1.5,
            },
          ],
        },
      },
    }),
  });
}

async function candidateCount(): Promise<number> {
  const page = await getCandidateStore().listCandidates(defaultCandidateListFilters());
  return page.total;
}

/** Wrapper that records every candidate-store interaction. */
function recordingStore(): { calls: string[]; store: CandidateStore } {
  const calls: string[] = [];
  const inner = createMemoryCandidateStore();
  return {
    calls,
    store: {
      storageMode: "memory",
      durable: false,
      async createCandidate(insert) {
        calls.push("createCandidate");
        return inner.createCandidate(insert);
      },
      async getCandidate(id) {
        calls.push("getCandidate");
        return inner.getCandidate(id);
      },
      async listCandidates(filters) {
        calls.push("listCandidates");
        return inner.listCandidates(filters);
      },
      async transitionCandidateStatus(input) {
        calls.push("transitionCandidateStatus");
        return inner.transitionCandidateStatus(input);
      },
    },
  };
}

async function rawPublicBody(): Promise<Record<string, unknown>> {
  const res = await publicRoute.POST(publicBuilderRequest());
  assert.ok(
    res.status === 200 || res.status === 422,
    `public Builder must execute; got ${res.status}`,
  );
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Fields that vary between two identical consecutive calls for reasons that have nothing to
 * do with Builder Approval. `snapshotId` is a content hash over the data snapshot, and with
 * no provider data its input includes a fresh `fetchedAt`, so it moves with the clock.
 * `runtime_public_builder_control_only_time_derived_fields_vary` proves this list is complete
 * rather than assuming it.
 */
const TIME_DERIVED_PATHS = [
  "requestId",
  "snapshotId",
  "generatedAt",
  "dataFreshness.listsFetchedAt",
];

function differingPaths(
  a: unknown,
  b: unknown,
  prefix = "",
  out: string[] = [],
): string[] {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differingPaths(a[key], b[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(prefix);
  return out;
}

function stripTimeDerived(body: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(body);
  for (const dotted of TIME_DERIVED_PATHS) {
    const parts = dotted.split(".");
    let cursor: Record<string, unknown> | undefined = clone;
    for (let i = 0; i < parts.length - 1 && cursor; i++) {
      cursor = cursor[parts[i]] as Record<string, unknown> | undefined;
    }
    if (cursor) delete cursor[parts[parts.length - 1]];
  }
  return clone;
}

/* ------------------------------------------------------------------ *
 * 3. Public Builder runtime smoke
 * ------------------------------------------------------------------ */

test("runtime_public_builder_executes_and_creates_no_candidate", async () => {
  resetCandidateStoreForTests();
  resetRateLimitBuckets();

  const before = await candidateCount();
  const res = await publicRoute.POST(publicBuilderRequest());
  const after = await candidateCount();

  assert.ok(res.status === 200 || res.status === 422, `got ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(typeof body.snapshotId, "string");
  assert.equal(typeof body.status, "string");
  assert.ok(Array.isArray(body.combinations));

  assert.equal(before, 0, "candidate count before");
  assert.equal(after, 0, "candidate count after");
});

test("runtime_public_builder_performs_zero_candidate_store_interactions", async () => {
  const rec = recordingStore();
  setCandidateStore(rec.store);
  resetRateLimitBuckets();

  // Prove the recorder is actually wired, then clear the log.
  await candidateCount();
  assert.deepEqual(rec.calls, ["listCandidates"], "recorder must be active");
  rec.calls.length = 0;

  await publicRoute.POST(publicBuilderRequest());
  await publicRoute.POST(publicBuilderRequest());

  assert.deepEqual(rec.calls, [], "public Builder must not touch the candidate store");
  resetCandidateStoreForTests();
});

test("runtime_public_builder_control_only_time_derived_fields_vary", async () => {
  // CONTROL: establishes the baseline variance between two identical calls with NO approval
  // activity in between, so the comparisons below cannot hide a real difference.
  resetCandidateStoreForTests();
  resetRateLimitBuckets();

  const a = await rawPublicBody();
  const b = await rawPublicBody();
  const differing = differingPaths(a, b);

  for (const p of differing) {
    assert.ok(
      TIME_DERIVED_PATHS.includes(p),
      `unexpected volatile field "${p}" — the time-derived list is incomplete`,
    );
  }
  assert.deepEqual(
    stripTimeDerived(a),
    stripTimeDerived(b),
    "everything except time-derived fields must be stable across calls",
  );
});

test("runtime_public_builder_output_identical_before_and_after_candidate_creation", async () => {
  resetCandidateStoreForTests();
  resetRateLimitBuckets();

  const first = await rawPublicBody();

  const created = await adminRoute.POST(adminCreateRequest("isolation-key-0001"));
  assert.equal(created.status, 201);
  assert.equal(await candidateCount(), 1, "a candidate must now exist");

  const second = await rawPublicBody();

  // No field beyond the control set may differ.
  for (const p of differingPaths(first, second)) {
    assert.ok(
      TIME_DERIVED_PATHS.includes(p),
      `candidate creation changed public Builder field "${p}"`,
    );
  }
  assert.deepEqual(
    stripTimeDerived(second),
    stripTimeDerived(first),
    "public Builder output must be unchanged by candidate creation",
  );
  assert.equal(await candidateCount(), 1, "public Builder must not add or remove candidates");
});

test("runtime_public_builder_identical_with_flag_on_and_off", async () => {
  resetCandidateStoreForTests();
  resetRateLimitBuckets();

  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  const on = await rawPublicBody();
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  const off = await rawPublicBody();
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";

  for (const p of differingPaths(on, off)) {
    assert.ok(
      TIME_DERIVED_PATHS.includes(p),
      `the approval flag changed public Builder field "${p}"`,
    );
  }
  assert.deepEqual(
    stripTimeDerived(off),
    stripTimeDerived(on),
    "public Builder must not depend on the approval flag",
  );
});

/* ------------------------------------------------------------------ *
 * Admin route runtime isolation from Builder generation
 * ------------------------------------------------------------------ */

test("runtime_admin_route_does_not_invoke_builder_generation", async () => {
  resetCandidateStoreForTests();
  resetRateLimitBuckets();

  const res = await adminRoute.POST(adminCreateRequest("isolation-key-0002"));
  assert.equal(res.status, 201);
  const body = (await res.json()) as Record<string, unknown>;
  for (const generationField of [
    "combinations",
    "providerAvailability",
    "dataFreshness",
    "candidateCount",
    "eligibleCount",
    "exclusionSummary",
  ]) {
    assert.ok(
      !(generationField in body),
      `admin response must not contain generation field ${generationField}`,
    );
  }
  // The stored source snapshot is the CALLER-supplied value, never a freshly generated one.
  const candidate = body.candidate as Record<string, unknown>;
  assert.equal(candidate.sourceSnapshotId, "snap_isolation");
});

test("runtime_admin_route_succeeds_with_providers_unavailable", async () => {
  // No provider is reachable in this environment; the admin route still succeeds, which
  // proves it has no provider or Builder-generation dependency at runtime.
  resetCandidateStoreForTests();
  resetRateLimitBuckets();
  const res = await adminRoute.POST(adminCreateRequest("isolation-key-0003"));
  assert.equal(res.status, 201);
  assert.equal(await candidateCount(), 1);
});
