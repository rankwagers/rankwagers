/**
 * Launch readiness preflight (Sprint 37).
 *
 * Builds a LaunchProbe from the ACTUAL environment and repository, runs the register in
 * lib/launch/readiness.ts, prints the classified checklist and writes a machine-readable report.
 *
 *   node scripts/launch-readiness.mjs            print + write docs/launch-readiness.generated.json
 *   node scripts/launch-readiness.mjs --json     print JSON only
 *
 * DESIGN RULE
 *
 * This script only ever reports what it OBSERVED. It never runs a build, never connects to a
 * database, and never substitutes a local approximation for a production fact. The three
 * externally blocked conditions are hard-coded to `false` here because nothing this script can do
 * would legitimately set them true — flipping them requires evidence from an environment that does
 * not exist on this machine, and the honest output is "blocked", not a guess.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const jsonOnly = process.argv.includes("--json");

/* ------------------------------------------------------------------ *
 * Observations
 * ------------------------------------------------------------------ */

function read(rel) {
  const p = path.join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function resolveAppEnv() {
  const explicit = (process.env.APP_ENV || "").trim().toLowerCase();
  if (["development", "test", "staging", "production"].includes(explicit)) return explicit;
  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

/**
 * SITE_URL as configured, preferring the real environment and falling back to .env.local so the
 * report is meaningful on a developer machine. Never synthesised.
 */
function observeSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const envLocal = read(".env.local");
  if (!envLocal) return null;
  const m = envLocal.match(/^\s*SITE_URL\s*=\s*(.+)\s*$/m);
  return m ? m[1].trim() : null;
}

/** Secrets the runtime actually reads, with the minimum length env.ts enforces. */
const REQUIRED_SECRETS = [
  "ADMIN_KEY",
  "AFFILIATE_REDIRECT_SECRET",
  "ANALYTICS_SIGNING_SECRET",
  "CRON_SECRET",
  "DIAGNOSTICS_SECRET",
];

function observeWeakOrMissingSecrets() {
  const weak = [];
  for (const name of REQUIRED_SECRETS) {
    const value = process.env[name];
    if (!value || value.trim().length < 16) weak.push(name);
  }
  return weak;
}

function observeInstanceCount() {
  const raw = process.env.WEB_CONCURRENCY || process.env.PM2_INSTANCES;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Feature flags as they would resolve IN PRODUCTION, via the real resolver.
 *
 * Two things matter here and both were wrong in the first version.
 *
 * It calls `getFeatureFlags` rather than regex-scanning the source. `defaultsFor` computes values
 * (`attributionPersistenceEnabled: deployed`) instead of writing literals, so no pattern over the
 * text can be trusted — the first attempt silently resolved nothing and the report claimed no flow
 * was dark while the whole Acca chain was gated off.
 *
 * And it resolves for `production`, not for this machine. Launch readiness is a question about the
 * production environment; several flags key off `deployed`, so reading them in development would
 * describe an environment nobody is launching.
 */
async function observeFlags() {
  const modUrl = pathToFileURL(path.join(root, "lib", "config", "featureFlags.ts")).href;
  const { getFeatureFlags } = await import(modUrl);
  return getFeatureFlags({ ...process.env, APP_ENV: "production", NODE_ENV: "production" });
}

const instrumentation = read("instrumentation.ts") ?? "";
const rateLimitWired = /warnIfMultiInstanceMemoryLimiter/.test(instrumentation);
const bootValidationWired = /assertRuntimeEnvOrThrow/.test(instrumentation);

const RELEASE_SCRIPTS = [
  "build-verify.mjs",
  "smoke-staging.mjs",
  "backup-postgres.mjs",
  "restore-rehearsal.mjs",
  "rehearse-migrations.mjs",
  "rollback-release.sh",
];
const releaseScripts = Object.fromEntries(
  RELEASE_SCRIPTS.map((s) => [s, existsSync(path.join(root, "scripts", s))]),
);

const probe = {
  appEnv: resolveAppEnv(),
  siteUrl: observeSiteUrl(),
  weakOrMissingSecrets: observeWeakOrMissingSecrets(),
  bootValidationWired,
  flags: await observeFlags(),
  instanceCount: observeInstanceCount(),
  multiInstanceWarningWired: rateLimitWired,
  // Structural PG verification is asserted by an executed suite; the report records the suite's
  // presence, and `npm test` is what actually keeps it true.
  postgresStructureVerified: existsSync(
    path.join(root, "tests", "accaPostgresStructure.test.ts"),
  ),
  // Hard false. See the design rule at the top of this file.
  postgresRuntimeExecuted: false,
  productionBuildExecuted: false,
  stagingSmokeExecuted: false,
  releaseScripts,

  // --- Launch Checklist v1 observations ---
  postbackVerificationWired: /export function verifyPostbackRequest/.test(
    read("lib/affiliate/postbacks/verify.ts") ?? "",
  ),
  postbackAllowlistConfigured: Boolean((process.env.AFFILIATE_POSTBACK_IP_ALLOWLIST ?? "").trim()),
  robotsRoutePresent: existsSync(path.join(root, "app", "robots.ts")),
  stagingNoindexWired: /STAGING_NOINDEX/.test(
    (read("app/robots.ts") ?? "") + (read("app/layout.tsx") ?? ""),
  ),
  sitemapRoutePresent: existsSync(path.join(root, "app", "sitemap.ts")),
  canonicalWired: /alternatesFor/.test(read("lib/seo.ts") ?? ""),
  structuredDataPresent: existsSync(path.join(root, "lib", "seo-intelligence", "structured-data.ts")),
  searchConsoleVerified: Boolean((process.env.GOOGLE_SITE_VERIFICATION ?? "").trim()),
  analyticsConfigured: Boolean((process.env.NEXT_PUBLIC_GTM_ID ?? "").trim()),
  errorLoggingWired:
    /unhandledRejection/.test(instrumentation) && /uncaughtException/.test(instrumentation),
  healthEndpointPresent: existsSync(path.join(root, "app", "api", "health")),
  // Hard false: script presence is not rehearsal. See the design rule at the top.
  backupRehearsed: false,
  rollbackRehearsed: false,
};

/* ------------------------------------------------------------------ *
 * Run the register
 * ------------------------------------------------------------------ */

const mod = await import(pathToFileURL(path.join(root, "lib", "launch", "readiness.ts")).href);
const cl = await import(pathToFileURL(path.join(root, "lib", "launch", "checklist.ts")).href);
const results = mod.evaluateLaunchReadiness(probe);
const checklistConditions = cl.evaluateChecklistConditions(probe);
const allResults = [...results, ...checklistConditions];
const summary = mod.summarise(allResults);
const checklist = cl.launchChecklistV1(results, checklistConditions);
const progress = cl.checklistProgress(checklist);

const report = {
  generatedFor: probe.appEnv,
  siteUrl: probe.siteUrl,
  summary: {
    pass: summary.pass,
    fail: summary.fail,
    blocked: summary.blocked,
    launchable: summary.launchable,
  },
  conditions: allResults.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    title: r.title,
    detail: r.detail,
    evidence: r.evidence,
    limitation: r.limitation ?? null,
    blocker: r.blocker ?? null,
  })),
  checklist: summary.checklist,
  launchChecklistV1: {
    progress,
    items: checklist.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      conditions: i.conditions.map((c) => ({ id: c.id, status: c.status })),
    })),
  },
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const mark = { pass: "PASS   ", fail: "FAIL   ", blocked: "BLOCKED" };
  let category = "";
  console.log("");
  console.log(`LAUNCH READINESS — target: production (running in ${probe.appEnv})   SITE_URL=${probe.siteUrl ?? "(unset)"}`);
  console.log("");
  for (const r of allResults) {
    if (r.category !== category) {
      category = r.category;
      console.log(`  ${category.toUpperCase()}`);
    }
    console.log(`    [${mark[r.status]}] ${r.title}`);
    console.log(`              ${r.detail.replace(/\n/g, "\n              ")}`);
    if (r.limitation) console.log(`              LIMITATION: ${r.limitation}`);
  }
  console.log("");
  console.log(
    `  ${summary.pass} pass, ${summary.fail} fail, ${summary.blocked} externally blocked` +
      `  →  launchable: ${summary.launchable ? "YES" : "NO"}`,
  );
  console.log("");
  const box = { pass: "[x]", fail: "[ ]", blocked: "[~]" };
  console.log("  LAUNCH CHECKLIST v1");
  for (const i of checklist) {
    const note =
      i.status === "pass"
        ? ""
        : "  <- " +
          ((i.conditions.find((c) => c.status === "fail") ??
            i.conditions.find((c) => c.status === "blocked"))?.title ?? "no condition");
    console.log(`    ${box[i.status]} ${i.title}${note}`);
  }
  console.log(
    `    ${progress.done}/${progress.total} complete (${progress.percent}%)   ` +
      "[x] done   [~] externally blocked   [ ] actionable now",
  );
  console.log("");
  console.log("  SHORTEST PATH TO LAUNCH");
  summary.checklist.forEach((c, i) => console.log(`    ${i + 1}. ${c}`));
  console.log("");

  const outDir = path.join(root, "docs");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "launch-readiness.generated.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`  report written: ${path.relative(root, outPath)}`);
  console.log("");
}

// Blocked conditions must not fail CI — they are environmental, not defects. Real failures do.
process.exit(summary.fail > 0 ? 1 : 0);
