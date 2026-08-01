import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * Sprint 20B-B stage B6 — sprint-wide isolation proof.
 *
 * The whole sprint added a publication chain beside the Builder. The claim that must survive
 * closure is that it stayed BESIDE it: the public Builder, its generation engine and its scoring
 * are unchanged and do not load a single line of the new code.
 *
 * Module graphs are measured in CHILD PROCESSES via `require.cache`, following the Phase E
 * precedent. An in-process check would be worthless, because this suite's own imports would
 * already have polluted the graph.
 */

const root = process.cwd();

/**
 * Module-graph probe.
 *
 * Resolution strategy copied verbatim from the proven Phase E probe in
 * `tests/builderApprovalIsolation.test.ts`: the transpiler and the `server-only` mock are passed
 * as NODE CLI FLAGS with `cwd` set to the repository root, so they resolve against the project's
 * own `node_modules`. Requiring `tsx/cjs` from inside the temp-directory probe cannot work —
 * resolution there is relative to the temp file, which has no `node_modules`.
 *
 * Unlike the Phase E probe this keeps the FULL cache key list rather than filtering to
 * `/lib/` and `/app/`, because the assertions below also inspect `/components/`.
 */
function probeModuleGraph(relPath: string): string[] {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rw-b6-iso-"));
  const probeFile = path.join(dir, "probe.cjs");
  const target = path.join(root, relPath).replace(/\\/g, "\\\\");
  writeFileSync(
    probeFile,
    [
      `process.env.NODE_ENV = "test";`,
      `process.env.ADMIN_KEY = "b6-isolation-key-0123456789";`,
      `process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";`,
      `require("${target}");`,
      `const keys = Object.keys(require.cache)`,
      `  .map(function (k) { return k.replace(/\\\\/g, "/"); });`,
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
    `graph probe for ${relPath} failed:\n${res.stdout}\n${res.stderr}`,
  );
  const line = (res.stdout || "").split(/\r?\n/).find((l) => l.startsWith("__GRAPH__"));
  assert.ok(line, `graph probe produced no output for ${relPath}`);
  return JSON.parse(line.slice("__GRAPH__".length)) as string[];
}

const contains = (graph: string[], fragment: string): number =>
  graph.filter((m) => m.includes(fragment)).length;

/* ================================================================== *
 * 1. The public Builder does not load the publication chain
 * ================================================================== */

test("ISOLATION: the public Builder API loads none of the Sprint 20B-B code", () => {
  const graph = probeModuleGraph("app/api/acca/builder/route.ts");
  assert.ok(graph.length > 20, `sanity: graph looked empty (${graph.length} modules)`);

  for (const forbidden of [
    "/lib/acca-publication/",
    "/lib/builder-approval/",
    "/lib/api/accaComposition",
    "/lib/api/httpIdempotency",
    "/components/acca-publication/",
  ]) {
    assert.equal(
      contains(graph, forbidden),
      0,
      `the public Builder must not load ${forbidden} (graph: ${graph.length} modules)`,
    );
  }
});

test("ISOLATION: the public Builder still loads its own engine", () => {
  const graph = probeModuleGraph("app/api/acca/builder/route.ts");
  // A negative-only proof could pass by loading nothing at all. This confirms the route really
  // is the Builder.
  assert.ok(contains(graph, "/lib/acca-builder/") > 0, "the Builder engine must still be loaded");
});

/* ================================================================== *
 * 2. The public Acca pages do not load admin or Builder-generation code
 * ================================================================== */

test("ISOLATION: public Acca pages load no admin surface and no Builder generation", () => {
  const graph = probeModuleGraph("lib/acca-publication/public.ts");
  assert.ok(graph.length > 5, `sanity: graph looked empty (${graph.length} modules)`);

  for (const forbidden of [
    "/lib/api/adminGuard",
    "/lib/api/httpIdempotency",
    "/lib/security/adminAuth",
    "/lib/security/adminCsrf",
    "/components/acca-publication/AccaListView",
    "/components/acca-publication/AccaDetailView",
    "/components/builder-approval/",
    "/lib/acca-builder/",
    "/lib/decision-ledger/",
  ]) {
    assert.equal(
      contains(graph, forbidden),
      0,
      `the public read layer must not load ${forbidden}`,
    );
  }
  // It must load the visibility rule it depends on.
  assert.ok(contains(graph, "/lib/acca-publication/lifecycle") > 0);
});

/* ================================================================== *
 * 3. The Decision Ledger stays unwired
 * ================================================================== */

test("ISOLATION: Sprint 26 Decision Ledger is loaded by nothing this sprint added", () => {
  for (const entry of [
    "lib/acca-publication/public.ts",
    "lib/api/accaComposition.ts",
    "app/api/admin/accas/route.ts",
  ]) {
    const graph = probeModuleGraph(entry);
    assert.equal(
      contains(graph, "/lib/decision-ledger/"),
      0,
      `${entry} must not load the paused Decision Ledger`,
    );
  }
});

/* ================================================================== *
 * 4. Source-level boundaries across the whole sprint
 * ================================================================== */

const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("BOUNDARY: no Sprint 20B-B module imports Builder generation or scoring", () => {
  const sprintModules = [
    "lib/acca-publication/contracts.ts",
    "lib/acca-publication/store.ts",
    "lib/acca-publication/service.ts",
    "lib/acca-publication/mapper.ts",
    "lib/acca-publication/public.ts",
    "lib/acca-publication/schema.ts",
    "lib/acca-publication/presentation.ts",
    "lib/api/accaComposition.ts",
    "lib/api/responses.ts",
    "lib/api/adminGuard.ts",
    "lib/api/httpIdempotency.ts",
  ];
  for (const rel of sprintModules) {
    const src = codeOnly(read(rel));
    for (const forbidden of ["lib/acca-builder", "lib/footystats", "lib/combo/", "lib/decision-ledger"]) {
      assert.equal(
        src.includes(forbidden),
        false,
        `${rel} must not import ${forbidden} — the publication chain copies, it never regenerates`,
      );
    }
  }
});

test("BOUNDARY: the domain does not depend on the site's i18n registry", () => {
  // The B6 locale fix was deliberately placed in the API route, not in the domain, so
  // lib/acca-publication stays self-contained and portable.
  for (const rel of [
    "lib/acca-publication/contracts.ts",
    "lib/acca-publication/service.ts",
    "lib/acca-publication/store.ts",
    "lib/acca-publication/mapper.ts",
    "lib/acca-publication/filters.ts",
    "lib/acca-publication/lifecycle.ts",
    "lib/acca-publication/odds.ts",
    "lib/acca-publication/slug.ts",
  ]) {
    assert.equal(
      codeOnly(read(rel)).includes("@/lib/i18n"),
      false,
      `${rel} must not depend on the site locale registry`,
    );
  }
  // The composition point DOES, which is where the check belongs.
  assert.match(
    read("app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route.ts"),
    /from "@\/lib\/i18n"/,
  );
});

test("BOUNDARY: no public surface can reach a mutation", () => {
  for (const rel of [
    "app/[locale]/accas/page.tsx",
    "app/[locale]/accas/[slug]/page.tsx",
    "components/acca-publication/PublicAccaIndexView.tsx",
    "components/acca-publication/PublicAccaDetailView.tsx",
    "components/acca-publication/PublicAccaCard.tsx",
    "components/homepage/HomepagePublishedAccas.tsx",
  ]) {
    const src = codeOnly(read(rel));
    for (const forbidden of [
      "transitionAccaLifecycle",
      "createAccaDraftFromCandidate",
      "transitionCandidateStatus",
      'method: "POST"',
      "/api/admin/",
    ]) {
      assert.equal(src.includes(forbidden), false, `${rel} must not reach ${forbidden}`);
    }
  }
});

/* ================================================================== *
 * 5. Sprint-wide invariants that must still hold at closure
 * ================================================================== */

test("CLOSURE: the store contract still exposes no arbitrary write", () => {
  const src = read("lib/acca-publication/store.ts");
  for (const forbidden of ["updateAcca", "patchAcca", "saveAcca", "setAcca", "deleteAcca"]) {
    assert.equal(
      new RegExp(`(async\\s+)?${forbidden}\\s*[(:]`).test(src),
      false,
      `store must not declare ${forbidden}`,
    );
  }
});

test("CLOSURE: every admin mutation route still requires the full security pipeline", () => {
  const routes = [
    "app/api/admin/builder-approval/candidates/[candidateId]/approve/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/reject/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route.ts",
    "app/api/admin/accas/[accaId]/publish/route.ts",
    "app/api/admin/accas/[accaId]/archive/route.ts",
  ];
  for (const rel of routes) {
    const src = read(rel);
    // Either the route itself, or the shared handler it delegates to, must carry the pipeline.
    const delegated = /handleCandidateTransition|handleAccaLifecycle/.test(src);
    const inline = /guardAdminRequest/.test(src);
    assert.ok(delegated || inline, `${rel} must run the admin guard`);
    assert.match(src, /export const runtime = "nodejs"/, `${rel} runtime`);
    assert.match(src, /export const dynamic = "force-dynamic"/, `${rel} caching`);
  }
  // The shared handlers do carry it.
  for (const rel of ["lib/api/candidateTransitionRoute.ts", "lib/api/accaLifecycleRoute.ts"]) {
    const src = read(rel);
    assert.match(src, /guardAdminRequest\({[\s\S]*requireCsrf: true/, `${rel} CSRF`);
    assert.match(src, /withHttpIdempotency/, `${rel} idempotency`);
    assert.match(src, /validateIdempotencyKey/, `${rel} key validation`);
  }
});

test("CLOSURE: the feature flag still gates every Acca surface", () => {
  const gated = [
    "app/api/admin/accas/route.ts",
    "app/api/admin/accas/[accaId]/route.ts",
    "app/admin/accas/page.tsx",
    "app/admin/accas/[accaId]/page.tsx",
  ];
  for (const rel of gated) {
    const src = read(rel);
    const viaGuard = /guardAdminRequest/.test(src);
    const viaFlag = /operatorApprovalEnabled/.test(src);
    assert.ok(viaGuard || viaFlag, `${rel} must be feature-gated`);
  }
  // The guard checks the flag before authentication.
  const guard = read("lib/api/adminGuard.ts");
  const flagAt = guard.indexOf("operatorApprovalEnabled");
  const authAt = guard.indexOf("evaluateAdminRequest(req)");
  assert.ok(flagAt > 0 && flagAt < authAt, "the flag must be checked before authentication");
});

test("CLOSURE: PostgreSQL remains structurally implemented and honestly unexecuted", () => {
  const adapter = read("lib/acca-publication/adapters/postgres.ts");
  assert.match(adapter, /NOT EXECUTED against a real PostgreSQL server/);
  assert.match(adapter, /client\.query\("BEGIN"\)/);
  assert.match(adapter, /client\.query\("COMMIT"\)/);
  assert.match(adapter, /client\.query\("ROLLBACK"\)/);
  const migration = read("db/migrations/20260728_create_published_accas.sql");
  assert.match(migration, /NOT EXECUTED/);
});
