import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getFeatureFlags, publicFeatureFlags } from "../lib/config/featureFlags";
import { buildReadinessReport } from "../lib/monitoring/health";

const root = process.cwd();
const MIGRATION = "db/migrations/20260726_create_builder_approval.sql";
const env = (v: Record<string, string>) => v as NodeJS.ProcessEnv;

/* ------------------------------------------------------------------ *
 * Sprint 20B-A files exist
 * ------------------------------------------------------------------ */

test("sprint 20B-A phase A-D files exist", () => {
  for (const rel of [
    "lib/builder-approval/contracts.ts",
    "lib/builder-approval/identifiers.ts",
    "lib/builder-approval/checksum.ts",
    "lib/builder-approval/validation.ts",
    "lib/builder-approval/filters.ts",
    "lib/builder-approval/environment.ts",
    "lib/builder-approval/store.ts",
    "lib/builder-approval/service.ts",
    "lib/builder-approval/analytics.ts",
    "lib/builder-approval/adapters/memory.ts",
    "lib/builder-approval/adapters/postgres.ts",
    "lib/security/adminCsrf.ts",
    MIGRATION,
    "app/api/admin/builder-approval/candidates/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/route.ts",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
});

/**
 * Phase E deliverables, now implemented. This was previously a `todo` describing planned
 * paths; it now asserts what Phase E actually shipped. Two deliberate differences from the
 * original plan, both narrower rather than wider:
 *  - the detail route is `/admin/builder-approval/[candidateId]` (permitted by the Phase E
 *    brief) instead of a nested `/candidate/[candidateId]` segment;
 *  - there is no separate `methodology` page. Its content lives in the operator guide and in
 *    an explanatory panel on the list page, because the brief forbids creating product
 *    methodology documentation.
 */
test("sprint 20B-A phase E admin UI and docs exist", () => {
  for (const rel of [
    "app/admin/builder-approval/page.tsx",
    "app/admin/builder-approval/[candidateId]/page.tsx",
    "components/builder-approval/CandidateListView.tsx",
    "components/builder-approval/CandidateDetailView.tsx",
    "lib/builder-approval/presentation.ts",
    "docs/builder-approval-operations.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
});

test("phase E documentation states both external conditions honestly", () => {
  const doc = readFileSync(path.join(root, "docs/builder-approval-operations.md"), "utf8");
  assert.match(doc, /PostgreSQL runtime behaviour is not yet integration-proven\./);
  assert.match(
    doc,
    /A full production build with a real HTTPS SITE_URL has not yet been proven\./,
  );
  // Must not claim capabilities that do not exist.
  assert.match(doc, /not implemented \(Sprint 20B-B\)/);
  assert.match(doc, /read-only/i);
});

test("phase E admin pages are not exposed to public surfaces", () => {
  // Admin routes inherit noindex from app/admin/layout.tsx; assert that is still true and
  // that nothing added a public entry point.
  const layout = readFileSync(path.join(root, "app/admin/layout.tsx"), "utf8");
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /noindex, nofollow, noarchive/);
  for (const rel of [
    "app/admin/builder-approval/page.tsx",
    "app/admin/builder-approval/[candidateId]/page.tsx",
  ]) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /AdminGate/, `${rel} must be wrapped in AdminGate`);
    assert.match(src, /operatorApprovalEnabled/, `${rel} must check the feature flag`);
    assert.match(src, /notFound\(\)/, `${rel} must 404 when disabled`);
  }
});

/* ------------------------------------------------------------------ *
 * Migration shape (not executed)
 * ------------------------------------------------------------------ */

test("migration creates the candidate table additively", () => {
  const sql = readFileSync(path.join(root, MIGRATION), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS builder_publication_candidates/);
  for (const column of [
    "candidate_id",
    "schema_version",
    "status",
    "actor",
    "source_request_id",
    "source_snapshot_id",
    "source_date",
    "builder_config",
    "payload",
    "payload_checksum",
    "checksum_version",
    "idempotency_key",
    "request_fingerprint",
    "created_at",
  ]) {
    assert.ok(sql.includes(column), `migration missing column ${column}`);
  }
});

test("migration constrains status to DRAFT only for this sprint", () => {
  const sql = readFileSync(path.join(root, MIGRATION), "utf8");
  assert.match(sql, /CHECK \(status = 'DRAFT'\)/);
  for (const forbidden of ["APPROVED", "REJECTED", "PUBLISHED", "READY_FOR_REVIEW", "SCHEDULED"]) {
    assert.ok(!sql.includes(forbidden), `migration must not reference ${forbidden}`);
  }
});

test("migration enforces NOT NULL and CHECK invariants", () => {
  const sql = readFileSync(path.join(root, MIGRATION), "utf8");
  assert.match(sql, /payload\s+JSONB\s+NOT NULL/);
  assert.match(sql, /payload_checksum\s+TEXT\s+NOT NULL/);
  assert.match(sql, /created_at\s+TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /CHECK \(actor = 'admin'\)/);
  assert.match(sql, /char_length\(payload_checksum\) = 64/);
  assert.match(sql, /candidate_id ~ '\^bpc_\[0-9a-f\]\{32\}\$'/);
});

test("migration creates the unique idempotency index and required lookup indexes", () => {
  const sql = readFileSync(path.join(root, MIGRATION), "utf8");
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS builder_publication_candidates_idempotency_key_uidx/,
  );
  assert.match(sql, /ON builder_publication_candidates \(idempotency_key\)/);
  assert.match(sql, /created_at DESC, candidate_id DESC/);
  assert.match(sql, /\(source_request_id\)[\s\S]*WHERE source_request_id IS NOT NULL/);
  assert.match(sql, /\(source_snapshot_id\)[\s\S]*WHERE source_snapshot_id IS NOT NULL/);
});

test("migration contains no destructive statement", () => {
  const sql = readFileSync(path.join(root, MIGRATION), "utf8").toUpperCase();
  for (const forbidden of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM", "ALTER COLUMN"]) {
    assert.ok(!sql.includes(forbidden), `migration must not contain ${forbidden}`);
  }
});

/**
 * Updated in Sprint 20B-B stage B1. Sprint 20B-A asserted the adapter issued NO UPDATE at
 * all. The approved lifecycle decision adds exactly one guarded UPDATE, so this now asserts
 * the stronger, still-honest property: there is a single UPDATE, it is the guarded lifecycle
 * transition, it writes no business column, and there is still no DELETE.
 */
test("postgres adapter issues one guarded UPDATE and no DELETE against candidates", () => {
  const src = readFileSync(
    path.join(root, "lib/builder-approval/adapters/postgres.ts"),
    "utf8",
  );
  const upper = src.toUpperCase();

  assert.ok(!upper.includes("DELETE FROM BUILDER_PUBLICATION_CANDIDATES"));
  assert.ok(upper.includes("ON CONFLICT (IDEMPOTENCY_KEY) DO NOTHING"));

  const updates = (upper.match(/UPDATE BUILDER_PUBLICATION_CANDIDATES/g) ?? []).length;
  assert.equal(updates, 1, "exactly one UPDATE statement may exist");

  // That single UPDATE is guarded on id + status + version and increments version.
  assert.match(src, /AND status = \$7/);
  assert.match(src, /AND version = \$8/);
  assert.match(src, /version = version \+ 1/);

  // It must never ASSIGN a business column. Scope the check to the UPDATE's SET clause:
  // business columns legitimately appear elsewhere as WHERE predicates and ON CONFLICT
  // targets, so a whole-file substring check would be a false positive.
  const setClause = /UPDATE builder_publication_candidates\s+SET([\s\S]*?)WHERE/.exec(src)?.[1];
  assert.ok(setClause, "could not locate the UPDATE SET clause");
  for (const businessColumn of [
    "payload",
    "builder_config",
    "payload_checksum",
    "checksum_version",
    "idempotency_key",
    "request_fingerprint",
    "created_at",
    "source_request_id",
    "source_snapshot_id",
    "source_date",
    "schema_version",
    "actor",
  ]) {
    assert.ok(
      !new RegExp(`\\b${businessColumn}\\s*=`).test(setClause),
      `UPDATE must never assign ${businessColumn}`,
    );
  }
  // The SET clause assigns only the lifecycle block.
  for (const lifecycleColumn of [
    "status",
    "version",
    "status_changed_at",
    "status_actor",
    "rejection_reason",
    "converted_acca_id",
  ]) {
    assert.match(setClause, new RegExp(`\\b${lifecycleColumn}\\s*=`));
  }
});

/* ------------------------------------------------------------------ *
 * Feature flag
 * ------------------------------------------------------------------ */

test("operator approval flag defaults to false in every environment", () => {
  for (const appEnv of ["development", "test", "staging", "production"]) {
    assert.equal(
      getFeatureFlags(env({ APP_ENV: appEnv })).operatorApprovalEnabled,
      false,
      `expected false in ${appEnv}`,
    );
  }
});

test("operator approval flag can be enabled explicitly", () => {
  assert.equal(
    getFeatureFlags(env({ FF_OPERATOR_APPROVAL_ENABLED: "true" })).operatorApprovalEnabled,
    true,
  );
  assert.equal(
    getFeatureFlags(env({ FF_OPERATOR_APPROVAL_ENABLED: "1" })).operatorApprovalEnabled,
    true,
  );
});

test("unknown flag values fail safe to disabled", () => {
  for (const raw of ["maybe", "yes-please", "2", " "]) {
    assert.equal(
      getFeatureFlags(env({ FF_OPERATOR_APPROVAL_ENABLED: raw })).operatorApprovalEnabled,
      false,
      `expected "${raw}" to fail safe`,
    );
  }
});

test("emergency kill switch overrides an enabled approval flag", () => {
  assert.equal(
    getFeatureFlags(
      env({
        FF_OPERATOR_APPROVAL_ENABLED: "true",
        FF_EMERGENCY_DISABLE_APPROVAL: "true",
      }),
    ).operatorApprovalEnabled,
    false,
  );
});

test("approval flag is never exposed through publicFeatureFlags", () => {
  const pub = publicFeatureFlags(env({ FF_OPERATOR_APPROVAL_ENABLED: "true" })) as Record<
    string,
    unknown
  >;
  assert.ok(!("operatorApprovalEnabled" in pub));
});

test("enabling approval does not alter any other flag", () => {
  const off = getFeatureFlags(env({ APP_ENV: "development" }));
  const on = getFeatureFlags(
    env({ APP_ENV: "development", FF_OPERATOR_APPROVAL_ENABLED: "true" }),
  );
  const { operatorApprovalEnabled: _offValue, ...restOff } = off;
  const { operatorApprovalEnabled: _onValue, ...restOn } = on;
  void _offValue;
  void _onValue;
  assert.deepEqual(restOn, restOff);
});

/* ------------------------------------------------------------------ *
 * Health / readiness reporting
 * ------------------------------------------------------------------ */

test("readiness reports builder_approval state honestly", async () => {
  const report = await buildReadinessReport();
  const check = report.checks.find((c) => c.name === "builder_approval");
  assert.ok(check, "readiness must include a builder_approval check");
  // Flag defaults to false, so the honest report is "disabled".
  assert.equal(check.status, "ok");
  assert.match(check.detail ?? "", /disabled/);
});

test("readiness includes the builder approval migration expectation", async () => {
  const report = await buildReadinessReport();
  const migration = report.checks.find((c) => c.name === "migration");
  assert.ok(migration);
  assert.equal(migration.status, "ok", migration.detail);
});

test("readiness output never contains a connection string or secret", async () => {
  const serialized = JSON.stringify(await buildReadinessReport());
  assert.ok(!serialized.includes("postgres://"));
  assert.ok(!serialized.includes("postgresql://"));
  assert.ok(!/password/i.test(serialized));
});
