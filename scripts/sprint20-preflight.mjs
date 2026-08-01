/**
 * Sprint 20 pre-deployment gate runner.
 * Writes docs/sprint-20-preflight.generated.json (no secrets).
 *
 * Usage: node scripts/sprint20-preflight.mjs [--skip-build]
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipBuild = process.argv.includes("--skip-build");
const outPath = path.join(root, "docs", "sprint-20-preflight.generated.json");

function run(label, cmd, args) {
  const started = Date.now();
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  return {
    label,
    ok: res.status === 0,
    exitCode: res.status ?? 1,
    ms: Date.now() - started,
  };
}

function siteUrlHost() {
  try {
    return new URL(process.env.SITE_URL || "").hostname || null;
  } catch {
    return null;
  }
}

function isPlaceholderHost(host) {
  if (!host) return true;
  return /gercek-domainin|example\.com|your-domain|localhost|127\.0\.0\.1/i.test(
    host
  );
}

const gates = [];
gates.push(run("tests", "npm", ["test"]));
gates.push(run("lint", "npx", ["next", "lint"]));
gates.push(run("typecheck", "npm", ["run", "typecheck"]));
gates.push(run("security_scan", "node", ["scripts/security-scan.mjs"]));
gates.push(run("cta_boundary", "node", ["scripts/scan-client-cta-boundary.mjs"]));
gates.push(run("route_inventory", "node", ["scripts/route-inventory.mjs"]));
if (!skipBuild) {
  gates.push(run("build", "npm", ["run", "build"]));
  gates.push(run("cta_boundary_postbuild", "node", ["scripts/scan-client-cta-boundary.mjs"]));
} else {
  gates.push({ label: "build", ok: true, exitCode: 0, ms: 0, skipped: true });
}

const host = siteUrlHost();
const envGate = {
  label: "production_site_url",
  ok: Boolean(host) && !isPlaceholderHost(host),
  exitCode: host && !isPlaceholderHost(host) ? 0 : 1,
  ms: 0,
  host,
  placeholder: isPlaceholderHost(host),
  message: isPlaceholderHost(host)
    ? "SITE_URL is missing or a placeholder — live promote blocked"
    : "SITE_URL looks production-ready",
};
gates.push(envGate);

const stagingGate = {
  label: "staging_base_url",
  ok: Boolean(process.env.STAGING_BASE_URL?.trim()),
  exitCode: process.env.STAGING_BASE_URL?.trim() ? 0 : 1,
  ms: 0,
  message: process.env.STAGING_BASE_URL?.trim()
    ? "STAGING_BASE_URL set"
    : "STAGING_BASE_URL unset — live staging smoke blocked",
};
gates.push(stagingGate);

const failed = gates.filter((g) => !g.ok);
const report = {
  ok: failed.length === 0,
  engineeringGatesOk: gates
    .filter((g) =>
      ["tests", "lint", "typecheck", "security_scan", "cta_boundary", "route_inventory", "build", "cta_boundary_postbuild"].includes(
        g.label
      )
    )
    .every((g) => g.ok || g.skipped),
  livePromoteReady: envGate.ok && stagingGate.ok,
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  gates,
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, engineeringGatesOk: report.engineeringGatesOk, livePromoteReady: report.livePromoteReady, outPath }, null, 2));

// Engineering gates must pass; placeholder SITE_URL is expected to fail livePromoteReady.
// Exit 0 if engineering ok so local Sprint 20 package can complete; exit 1 only on eng failure.
process.exit(report.engineeringGatesOk ? 0 : 1);
