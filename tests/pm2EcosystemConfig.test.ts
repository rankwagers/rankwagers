import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { PM2_KILL_TIMEOUT_MS, MAX_SIGNAL_GRACE_MS } from "../lib/monitoring/shutdown";

const requireCjs = createRequire(path.join(__dirname, "loader.cjs"));
const CONFIG = path.resolve(__dirname, "../deploy/ecosystem.config.cjs");
const RETIRED = path.resolve(__dirname, "../deploy/ecosystem.rankwagers.cjs");

// RF-3 — exactly one authoritative production ecosystem config; the conflicting one is retired.

test("aff-site is the authoritative app, runs next directly on :3000, with hardening knobs", () => {
  const cfg = requireCjs(CONFIG);
  const aff = cfg.apps.find((a: { name: string }) => a.name === "aff-site");
  assert.ok(aff, "aff-site app must exist");
  assert.match(aff.script, /next\/dist\/bin\/next$/, "runs next directly, not npm start");
  assert.match(aff.args, /-p 3000/);
  assert.equal(aff.env.PORT, "3000");
  assert.equal(aff.exec_mode, "fork");
  assert.equal(aff.instances, 1);
  assert.equal(aff.kill_timeout, 10000);
  assert.ok(aff.listen_timeout > 0, "listen_timeout present");
  assert.ok(aff.exp_backoff_restart_delay > 0, "exp_backoff_restart_delay present");
  assert.equal(aff.max_memory_restart, "700M");
});

test("no second app definition can bind port 3000", () => {
  const cfg = requireCjs(CONFIG);
  const binds3000 = cfg.apps.filter(
    (a: { args?: string; env?: { PORT?: string } }) =>
      /(^|\s)-p\s*3000(\s|$)/.test(a.args || "") || a.env?.PORT === "3000"
  );
  assert.equal(binds3000.length, 1, "exactly one app binds :3000");
  assert.equal(binds3000[0].name, "aff-site");
});

test("the conflicting ecosystem.rankwagers.cjs is retired (throws on load; cannot start :3000)", () => {
  assert.throws(() => requireCjs(RETIRED), /RETIRED/i);
});

test("kill_timeout stays above the graceful-shutdown ceiling (AD-1 coupling)", () => {
  const cfg = requireCjs(CONFIG);
  const aff = cfg.apps.find((a: { name: string }) => a.name === "aff-site");
  assert.equal(aff.kill_timeout, PM2_KILL_TIMEOUT_MS);
  assert.ok(aff.kill_timeout > MAX_SIGNAL_GRACE_MS, "kill_timeout must exceed the max drain window");
});
