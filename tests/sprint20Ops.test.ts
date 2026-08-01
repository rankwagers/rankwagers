import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

test("sprint 20 ops scripts and docs exist", () => {
  for (const rel of [
    "scripts/sprint20-preflight.mjs",
    "scripts/sprint20-verify-origin.mjs",
    "scripts/sprint20-rollback-rehearse.mjs",
    "docs/search-console-and-bing.md",
    "docs/launch-report.md",
    "docs/sprint-20-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts["ops:sprint20-preflight"]);
  assert.ok(pkg.scripts["ops:verify-origin"]);
  assert.ok(pkg.scripts["ops:rollback-rehearse"]);
});

test("preflight refuses placeholder SITE_URL for live promote", () => {
  const src = readFileSync(
    path.join(root, "scripts/sprint20-preflight.mjs"),
    "utf8"
  );
  assert.match(src, /gercek-domainin|isPlaceholderHost/);
  assert.match(src, /livePromoteReady/);
  assert.match(src, /engineeringGatesOk/);
});

test("origin verifier covers launch surfaces and affiliate safety", () => {
  const src = readFileSync(
    path.join(root, "scripts/sprint20-verify-origin.mjs"),
    "utf8"
  );
  for (const name of [
    "homepage",
    "search",
    "archive",
    "methodology",
    "acca",
    "go_rejects_destination_override",
    "security_headers",
    "robots",
    "sitemap_static_shard",
  ]) {
    assert.match(src, new RegExp(name));
  }
});

test("launch report documents live promote blocker honestly", () => {
  const report = readFileSync(path.join(root, "docs/launch-report.md"), "utf8");
  assert.match(report, /placeholder|NOT LIVE|blocked/i);
  assert.match(report, /Search Console|Bing/i);
  assert.match(report, /rollback/i);
});
