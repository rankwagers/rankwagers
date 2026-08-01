import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  assertPublicEntity,
  buildDataQualityApiResponse,
  filterFindings,
  getDataQualityReport,
  resetDataQualityCache,
} from "../lib/data-quality";

test("data quality report produces integrity scorecard without crashing", () => {
  resetDataQualityCache();
  const report = getDataQualityReport({ force: true });
  assert.ok(["healthy", "degraded", "unhealthy"].includes(report.status));
  assert.ok(report.integrity.overall >= 0 && report.integrity.overall <= 100);
  assert.ok(report.findings.length > 20);
  assert.ok(report.coverage.competitions >= 10);
  assert.ok(report.coverage.teams >= 20);
  assert.ok(report.coverage.seasons >= 10);
  assert.ok(report.integrity.categories.some((row) => row.category === "graph"));
});

test("health API payload hides sensitive provider details", () => {
  resetDataQualityCache();
  const payload = buildDataQualityApiResponse(getDataQualityReport({ force: true }));
  assert.ok(typeof payload.integrity === "number");
  assert.ok(typeof payload.registry === "number");
  assert.ok(typeof payload.graph === "number");
  assert.ok(typeof payload.seo === "number");
  assert.ok(typeof payload.analytics === "number");
  assert.equal("findings" in payload, false);
});

test("finding filters work for dashboard", () => {
  resetDataQualityCache();
  const report = getDataQualityReport({ force: true });
  const errors = filterFindings(report.findings, { severity: "error" });
  assert.ok(errors.every((row) => row.severity === "error"));
  const registry = filterFindings(report.findings, { category: "registry" });
  assert.ok(registry.every((row) => row.category === "registry"));
});

test("public entity gate rejects unknown entities", () => {
  assert.equal(assertPublicEntity("team", "not-a-real-team").allowed, false);
  assert.equal(assertPublicEntity("competition", "premier-league").allowed, true);
  assert.equal(assertPublicEntity("season", "2025-26", "premier-league").allowed, true);
  assert.equal(assertPublicEntity("season", "1999-00", "premier-league").allowed, false);
});

test("registry and graph audits report no hard errors for core entities", () => {
  resetDataQualityCache();
  const report = getDataQualityReport({ force: true });
  const hard = report.findings.filter(
    (row) =>
      row.severity === "error" &&
      (row.category === "registry" || row.category === "graph" || row.category === "routes")
  );
  assert.deepEqual(
    hard.map((row) => row.id),
    [],
    hard.map((row) => `${row.id}: ${row.message}`).join("; ")
  );
});

test("developer dashboard and API routes exist", () => {
  const root = path.resolve(__dirname, "..");
  assert.ok(existsSync(path.join(root, "app/developer/data-quality/page.tsx")));
  assert.ok(existsSync(path.join(root, "app/api/data-quality/route.ts")));
  assert.ok(existsSync(path.join(root, "lib/data-quality/index.ts")));
});
