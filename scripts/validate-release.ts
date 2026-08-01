/**
 * Machine-readable release gates. Exits 1 on failure. Never prints secret values.
 *
 * Usage: npx tsx scripts/validate-release.ts [--skip-build]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  isInsecureSecret,
  resolveAppEnv,
  validateRuntimeEnv,
} from "../lib/config/env";
import { getFeatureFlags } from "../lib/config/featureFlags";
import { buildSecurityHeaders } from "../lib/security/headers";

type Gate = { code: string; ok: boolean; message: string };

const root = path.resolve(process.cwd());
const skipBuild = process.argv.includes("--skip-build");
const gates: Gate[] = [];

function gate(code: string, ok: boolean, message: string) {
  gates.push({ code, ok, message });
}

function run(cmd: string, args: string[]): boolean {
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  return res.status === 0;
}

// 1) Unit tests
gate("tests", run("npm", ["test"]), "npm test must pass");

// 2) Lint
gate("lint", run("npx", ["next", "lint"]), "next lint must pass");

// 3) Typecheck
gate(
  "typecheck",
  run("npm", ["run", "typecheck"]),
  "TypeScript check must pass"
);

// 4) Env validation (use APP_ENV if set; else development-safe)
const envResult = validateRuntimeEnv();
if (envResult.appEnv === "production" || envResult.appEnv === "staging") {
  gate("env_deployed", envResult.ok, envResult.errors.join("; ") || "env ok");
} else {
  gate("env_dev", true, "non-deployed env — deployed secret gates skipped");
}

// 5) SITE_URL / placeholders in source
const seo = readFileSync(path.join(root, "lib", "seo.ts"), "utf8");
gate(
  "no_example_fallback",
  !seo.includes("example.com"),
  "seo.ts must not fall back to example.com"
);

// 6) Feature flag conservative diagnostics/cron defaults in production profile
const prodEnv = {
  ...process.env,
  APP_ENV: "production",
  NODE_ENV: "production",
  ENABLE_DIAGNOSTICS: undefined,
  ENABLE_DEVELOPER_TOOLS: undefined,
  ENABLE_CRON: undefined,
  FF_DEVELOPER_DIAGNOSTICS_ENABLED: undefined,
  FF_INTERNAL_CRON_ENABLED: undefined,
} as NodeJS.ProcessEnv;
const prodFlags = getFeatureFlags(prodEnv);
gate(
  "prod_diagnostics_default_off",
  prodFlags.developerDiagnosticsEnabled === false,
  "production diagnostics must default off"
);
gate(
  "prod_cron_default_off",
  prodFlags.internalCronEnabled === false,
  "production cron must default off"
);

// 7) Headers
const headers = buildSecurityHeaders();
const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value || "";
gate(
  "csp_frame_ancestors",
  csp.includes("frame-ancestors 'none'"),
  "CSP must deny framing"
);

// 8) Migrations present
for (const rel of [
  "db/migrations/20260724_create_odds_history.sql",
  "db/migrations/20260725_create_affiliate_attribution.sql",
  "db/migrations/20260726_create_provider_snapshots.sql",
]) {
  gate(
    `migration_${path.basename(rel)}`,
    existsSync(path.join(root, rel)),
    `${rel} must exist`
  );
}

// 9) Security scan
gate(
  "security_scan",
  run("node", ["scripts/security-scan.mjs"]),
  "security-scan must pass"
);

// 9b) Client CTA signing boundary (no client-side buildGoPath)
gate(
  "cta_boundary",
  run("node", ["scripts/scan-client-cta-boundary.mjs"]),
  "client CTA boundary scan must pass"
);

// 10) Route inventory
gate(
  "route_inventory",
  run("node", ["scripts/route-inventory.mjs"]),
  "route inventory generation must succeed"
);

// 11) Optional build
if (!skipBuild) {
  gate(
    "production_build",
    run("npm", ["run", "build"]),
    "production build must succeed"
  );
} else {
  gate("production_build", true, "skipped via --skip-build");
}

// 12) Staging isolation helpers exist
gate(
  "staging_robots",
  readFileSync(path.join(root, "app/robots.ts"), "utf8").includes("staging"),
  "robots.ts must isolate staging"
);

// 13) Secret helper sanity (no echo)
gate(
  "insecure_secret_helper",
  isInsecureSecret("admin") && !isInsecureSecret("a".repeat(24) + "Z9!"),
  "isInsecureSecret helper behaves"
);

const failed = gates.filter((g) => !g.ok);
const report = {
  ok: failed.length === 0,
  appEnv: resolveAppEnv(),
  passed: gates.filter((g) => g.ok).length,
  failed: failed.length,
  gates,
};
console.log(JSON.stringify(report, null, 2));
process.exit(failed.length ? 1 : 0);
