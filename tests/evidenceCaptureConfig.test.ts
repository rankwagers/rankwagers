import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAPTURE_LEAD_MINUTES,
  DEFAULT_CAPTURE_MAX_FIXTURES,
  isCaptureEnabled,
  isSettlementEnabled,
  resolveEvidenceCaptureConfig,
} from "../lib/evidence-capture/config";

/**
 * Sprint 23B — Phase 0 (Guardrails & config).
 *
 * Acceptance: feature flags default OFF and resolving config from an empty
 * environment has no side effects and yields documented defaults. Every value
 * here was produced by executing the resolver, not inferred.
 */

test("flags default OFF on an empty environment", () => {
  const cfg = resolveEvidenceCaptureConfig({});
  assert.equal(cfg.captureEnabled, false);
  assert.equal(cfg.settlementEnabled, false);
  assert.equal(isCaptureEnabled({}), false);
  assert.equal(isSettlementEnabled({}), false);
});

test("numeric and adapter defaults match the plan", () => {
  const cfg = resolveEvidenceCaptureConfig({});
  assert.equal(cfg.leadMinutes, DEFAULT_CAPTURE_LEAD_MINUTES);
  assert.equal(cfg.maxFixtures, DEFAULT_CAPTURE_MAX_FIXTURES);
  assert.equal(cfg.archiveAdapter, "file");
  assert.equal(cfg.archiveDir, null);
  assert.equal(cfg.databaseUrl, null);
});

test('flags accept only "true" or "1" (trimmed, case-insensitive)', () => {
  assert.equal(isCaptureEnabled({ EVIDENCE_CAPTURE_ENABLED: "true" }), true);
  assert.equal(isCaptureEnabled({ EVIDENCE_CAPTURE_ENABLED: " TRUE " }), true);
  assert.equal(isCaptureEnabled({ EVIDENCE_CAPTURE_ENABLED: "1" }), true);
  assert.equal(isCaptureEnabled({ EVIDENCE_CAPTURE_ENABLED: "yes" }), false);
  assert.equal(isCaptureEnabled({ EVIDENCE_CAPTURE_ENABLED: "0" }), false);
  assert.equal(isCaptureEnabled({ EVIDENCE_CAPTURE_ENABLED: "false" }), false);
  assert.equal(
    isSettlementEnabled({ EVIDENCE_SETTLEMENT_ENABLED: "1" }),
    true
  );
});

test("positive-int parsing falls back on malformed input", () => {
  assert.equal(
    resolveEvidenceCaptureConfig({ EVIDENCE_CAPTURE_LEAD_MINUTES: "90" })
      .leadMinutes,
    90
  );
  for (const bad of ["0", "-5", "abc", "12.5", "", "  "]) {
    assert.equal(
      resolveEvidenceCaptureConfig({ EVIDENCE_CAPTURE_LEAD_MINUTES: bad })
        .leadMinutes,
      DEFAULT_CAPTURE_LEAD_MINUTES,
      `expected fallback for ${JSON.stringify(bad)}`
    );
  }
  assert.equal(
    resolveEvidenceCaptureConfig({ EVIDENCE_CAPTURE_MAX_FIXTURES: "250" })
      .maxFixtures,
    250
  );
});

test("adapter selector normalizes and passes through dir/database", () => {
  assert.equal(
    resolveEvidenceCaptureConfig({ EVIDENCE_ARCHIVE_ADAPTER: "MEMORY" })
      .archiveAdapter,
    "memory"
  );
  assert.equal(
    resolveEvidenceCaptureConfig({ EVIDENCE_ARCHIVE_ADAPTER: "postgres" })
      .archiveAdapter,
    "postgres"
  );
  assert.equal(
    resolveEvidenceCaptureConfig({ EVIDENCE_ARCHIVE_ADAPTER: "bogus" })
      .archiveAdapter,
    "file"
  );
  const cfg = resolveEvidenceCaptureConfig({
    EVIDENCE_ARCHIVE_DIR: "  /opt/rankwagers/shared/evidence-archive  ",
    EVIDENCE_DATABASE_URL: "postgres://x/y",
  });
  assert.equal(cfg.archiveDir, "/opt/rankwagers/shared/evidence-archive");
  assert.equal(cfg.databaseUrl, "postgres://x/y");
});
