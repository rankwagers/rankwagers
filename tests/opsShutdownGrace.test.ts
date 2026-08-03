import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSignalGraceMs,
  MAX_SIGNAL_GRACE_MS,
  PM2_KILL_TIMEOUT_MS,
  DEFAULT_SIGNAL_GRACE_MS,
} from "../lib/monitoring/shutdown";
import { EFFECTIVE_DEADLINE_HARD_MAX_MS } from "../lib/evidence-capture/candidates/operational";

// AD-1 — SHUTDOWN_GRACE_MS must ALWAYS stay below PM2 kill_timeout with a safe margin.

test("default grace when SHUTDOWN_GRACE_MS unset", () => {
  assert.equal(resolveSignalGraceMs({}), DEFAULT_SIGNAL_GRACE_MS);
  assert.equal(DEFAULT_SIGNAL_GRACE_MS, 50000);
});

test("an override above kill_timeout is clamped below it (safe margin)", () => {
  assert.equal(resolveSignalGraceMs({ SHUTDOWN_GRACE_MS: "120000" }), MAX_SIGNAL_GRACE_MS);
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

/*
 * The evidence archive is append-only and permanent, so the drain window has to outlast the
 * longest run that WRITES, not the shortest that serves. Raising PM2's kill_timeout alone would
 * not have protected an in-flight append — the process exits itself once the drain window
 * elapses, so an 8s drain would still have severed a 45s capture long before PM2 escalated.
 * Both numbers must clear the capture deadline for the torn-line guarantee to hold.
 */
test("the drain window outlasts the capture deadline (torn-append protection)", () => {
  assert.ok(
    resolveSignalGraceMs({}) > EFFECTIVE_DEADLINE_HARD_MAX_MS,
    "default drain must exceed the 45s capture deadline so an in-flight append finishes"
  );
  assert.ok(
    PM2_KILL_TIMEOUT_MS > EFFECTIVE_DEADLINE_HARD_MAX_MS,
    "kill_timeout must exceed the capture deadline"
  );
  assert.ok(
    MAX_SIGNAL_GRACE_MS < PM2_KILL_TIMEOUT_MS,
    "the drain still ends strictly before PM2 escalates to SIGKILL"
  );
});
