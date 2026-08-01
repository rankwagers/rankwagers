import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSignalGraceMs,
  MAX_SIGNAL_GRACE_MS,
  PM2_KILL_TIMEOUT_MS,
  DEFAULT_SIGNAL_GRACE_MS,
} from "../lib/monitoring/shutdown";

// AD-1 — SHUTDOWN_GRACE_MS must ALWAYS stay below PM2 kill_timeout with a safe margin.

test("default grace when SHUTDOWN_GRACE_MS unset", () => {
  assert.equal(resolveSignalGraceMs({}), DEFAULT_SIGNAL_GRACE_MS);
  assert.equal(DEFAULT_SIGNAL_GRACE_MS, 8000);
});

test("an override above kill_timeout is clamped below it (safe margin)", () => {
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "20000" }), MAX_SIGNAL_GRACE_MS);
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "999999" }), MAX_SIGNAL_GRACE_MS);
  assert.ok(MAX_SIGNAL_GRACE_MS < PM2_KILL_TIMEOUT_MS, "max grace strictly below kill_timeout");
});

test("a valid sub-cap override is honoured", () => {
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "5000" }), 5000);
});

test("invalid / non-positive overrides fall back to the default", () => {
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "abc" }), DEFAULT_SIGNAL_GRACE_MS);
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "0" }), DEFAULT_SIGNAL_GRACE_MS);
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "-1" }), DEFAULT_SIGNAL_GRACE_MS);
});

test("resolved grace is always strictly below kill_timeout for any input", () => {
  for (const v of ["", "1", "8000", "9000", "10000", "10001", "50000", "abc", "-5"]) {
    const resolved = resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: v });
    assert.ok(resolved < PM2_KILL_TIMEOUT_MS, `grace ${resolved} must be < kill_timeout for input "${v}"`);
  }
});
