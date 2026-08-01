/**
 * Launch readiness register (Sprint 37).
 *
 * WHY THIS EXISTS
 *
 * The pieces needed to answer "can we launch?" already existed, but no single place held them.
 * Boot-time env validation lives in `lib/config/env.ts` and is wired through `instrumentation.ts`;
 * feature flags live in `lib/config/featureFlags.ts`; the memory-limiter caveat is warned by
 * `lib/security/rateLimit.ts`; and eight separate scripts cover build, smoke, migration rehearsal,
 * backup and rollback. Nobody could answer the launch question mechanically, so it was re-litigated
 * from prose every sprint — and the three externally blocked items were re-argued each time
 * because nothing recorded them in a machine-readable form.
 *
 * This module does NOT reimplement any of those checks. It is the register that names every launch
 * condition, points at whatever already proves it, and classifies the result.
 *
 * THE CLASSIFICATION RULE THAT MATTERS
 *
 * `blocked` is not a soft `fail`. It means the condition cannot be evaluated here at all, because
 * evaluating it requires infrastructure or an action that is deliberately unavailable — a real
 * PostgreSQL server, a real HTTPS origin, a staging deployment. A blocked condition must NEVER be
 * reported as `pass` on the strength of structural evidence, and this module is written so that is
 * impossible: blocked conditions have no passing branch.
 *
 * PURITY
 *
 * No I/O, no `process.env` reads, no imports from the app. Everything is decided from a
 * `LaunchProbe` snapshot supplied by the caller. `scripts/launch-readiness.mjs` builds that probe
 * from reality; tests build it by hand. This keeps the register deterministic and makes it
 * possible to assert what the checklist says under environments this machine does not have.
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type LaunchStatus = "pass" | "fail" | "blocked";

export type LaunchCategory =
  | "environment"
  | "feature-flags"
  | "durability"
  | "database"
  | "build"
  | "staging";

/** What an external blocker needs before it can be evaluated at all. */
export type ExternalBlocker = {
  /** The thing that is missing. */
  requires: string;
  /** The observable that would flip this condition from blocked to evaluable. */
  unblockedWhen: string;
};

export type LaunchCondition = {
  id: string;
  category: LaunchCategory;
  /** What must be true for launch. */
  title: string;
  /** What is already proving it, so the register never silently reimplements a check. */
  evidence: string;
  /**
   * A limitation that remains true even when this condition passes. Recorded so that a green
   * checklist cannot be mistaken for the absence of known constraints.
   */
  limitation?: string;
  blocker?: ExternalBlocker;
  /**
   * Optional Launch Checklist v1 item this condition rolls up into (see lib/launch/checklist.ts).
   * Kept as a plain string so the register stays independent of the checklist's vocabulary.
   */
  item?: string;
};

export type LaunchResult = LaunchCondition & {
  status: LaunchStatus;
  /** Why the status is what it is, in terms a reader can act on. */
  detail: string;
};

/**
 * A snapshot of everything the register needs to decide.
 *
 * Deliberately explicit rather than "read the world": every field is something a caller had to go
 * and observe, which is what makes a `pass` mean anything.
 */
export type LaunchProbe = {
  appEnv: "development" | "test" | "staging" | "production";
  /** Resolved SITE_URL, exactly as configured. Never synthesised. */
  siteUrl: string | null;
  /** Names of required secrets that are absent or too weak to be usable. */
  weakOrMissingSecrets: readonly string[];
  /** `instrumentation.register()` calls `assertRuntimeEnvOrThrow`. */
  bootValidationWired: boolean;
  /** Resolved feature flags. */
  flags: Readonly<Record<string, boolean>>;
  /** Process instance count implied by WEB_CONCURRENCY / PM2_INSTANCES. */
  instanceCount: number;
  /** `warnIfMultiInstanceMemoryLimiter` is invoked at boot. */
  multiInstanceWarningWired: boolean;
  /** The PostgreSQL adapter's SQL structure is covered by executed tests. */
  postgresStructureVerified: boolean;
  /**
   * A real PostgreSQL server was actually connected to and exercised. This must only ever be set
   * from an executed connection, never inferred.
   */
  postgresRuntimeExecuted: boolean;
  /** `next build` completed with exit code 0 against a real HTTPS origin. */
  productionBuildExecuted: boolean;
  /** Staging smoke tests ran against a deployed staging origin. */
  stagingSmokeExecuted: boolean;
  /** Release scripts present in the repo. */
  releaseScripts: Readonly<Record<string, boolean>>;
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const PLACEHOLDER_HOST =
  /localhost|127\.0\.0\.1|example\.com|your-domain|gercek-domainin|\.local$/i;

export function isLaunchableOrigin(siteUrl: string | null): boolean {
  if (!siteUrl) return false;
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return !PLACEHOLDER_HOST.test(url.hostname);
}

/**
 * Feature flags whose default-off state leaves a MAJOR product flow dark.
 *
 * Being off is not automatically wrong — most of these default off deliberately, and shipping them
 * dark is a legitimate choice. What is wrong is launching without having *decided*. Each entry
 * names the flow so the checklist forces an explicit call rather than an accidental one.
 */
export const FLOW_GATING_FLAGS: ReadonlyArray<{ flag: string; flow: string }> = [
  { flag: "affiliateOperatorsVisible", flow: "affiliate operator listings — the revenue surface" },
  { flag: "attributionPersistenceEnabled", flow: "click attribution persistence — revenue tracking" },
  { flag: "postbackIngestionEnabled", flow: "affiliate postback ingestion — conversion tracking" },
  { flag: "operatorApprovalEnabled", flow: "Builder approval and the entire Acca publication chain" },
  { flag: "comboRouteEnabled", flow: "combo routes" },
  { flag: "comboHomepageVisible", flow: "combo homepage placement" },
];

/* ------------------------------------------------------------------ *
 * The register
 * ------------------------------------------------------------------ */

export function evaluateLaunchReadiness(probe: LaunchProbe): LaunchResult[] {
  const results: LaunchResult[] = [];
  const add = (c: LaunchCondition, status: LaunchStatus, detail: string) =>
    results.push({ ...c, status, detail });

  /* --- environment ------------------------------------------------ */

  add(
    {
      id: "env.boot-validation-wired",
      category: "environment",
      title: "Invalid configuration fails at boot, not at first request",
      evidence: "instrumentation.register() calls assertRuntimeEnvOrThrow (lib/config/env.ts)",
    },
    probe.bootValidationWired ? "pass" : "fail",
    probe.bootValidationWired
      ? "Boot-time validation is wired; staging/production refuse to serve with invalid config."
      : "instrumentation.register() no longer calls assertRuntimeEnvOrThrow — a misconfigured " +
          "deploy would start and fail per-request instead of refusing to boot.",
  );

  add(
    {
      id: "env.secrets-present-and-strong",
      category: "environment",
      title: "Every required secret is present and not trivially weak",
      evidence: "isInsecureSecret + validateRuntimeEnv (lib/config/env.ts)",
    },
    probe.weakOrMissingSecrets.length === 0 ? "pass" : "fail",
    probe.weakOrMissingSecrets.length === 0
      ? "No required secret is missing or below the minimum strength."
      : `Weak or missing: ${probe.weakOrMissingSecrets.join(", ")}. These are read by signed ` +
          "redirects, admin auth, cron access and diagnostics — a weak value is an open door.",
  );

  add(
    {
      id: "env.public-origin-is-real",
      category: "environment",
      title: "SITE_URL is a real HTTPS origin, not a placeholder or localhost",
      evidence: "resolveSiteUrl + FORBIDDEN_PROD_HOSTS (lib/config/env.ts)",
      blocker: {
        requires: "a real production HTTPS domain",
        unblockedWhen: "SITE_URL is set to the live origin in the deployment environment",
      },
    },
    isLaunchableOrigin(probe.siteUrl) ? "pass" : "blocked",
    isLaunchableOrigin(probe.siteUrl)
      ? `SITE_URL is ${probe.siteUrl}.`
      : `SITE_URL is currently ${probe.siteUrl ?? "unset"}, which cannot serve production. This ` +
          "is a configuration input, not a code defect — nothing in the repo can satisfy it.",
  );

  /* --- feature flags ---------------------------------------------- */

  /*
   * A flag the probe could not resolve is NOT evidence that the flow is live.
   *
   * The first version of this check tested `flags[name] === false`, so a flag that failed to
   * resolve — `undefined` — silently counted as "not dark" and the register reported a clean bill
   * of health while the entire Acca chain was gated off. That is precisely the false green this
   * whole module exists to prevent, so an unresolved flag is now its own failure.
   */
  const unresolved = FLOW_GATING_FLAGS.filter((f) => typeof probe.flags[f.flag] !== "boolean");
  const dark = FLOW_GATING_FLAGS.filter((f) => probe.flags[f.flag] === false);
  add(
    {
      id: "flags.no-unintended-dark-flows",
      category: "feature-flags",
      title: "Every major product flow is either enabled or deliberately dark",
      evidence: "getFeatureFlags() resolved for the target environment (lib/config/featureFlags.ts)",
      limitation:
        "This condition proves the flags were LOOKED AT, not that the chosen values are right. " +
        "That decision is the owner's.",
    },
    unresolved.length > 0 || dark.length > 0 ? "fail" : "pass",
    unresolved.length > 0
      ? `${unresolved.length} flag(s) could not be resolved: ` +
          `${unresolved.map((u) => u.flag).join(", ")}. An unresolved flag proves nothing — ` +
          "treat this as unknown, not as enabled."
      : dark.length === 0
        ? "No flow-gating flag is off."
        : `${dark.length} major flow(s) would be dark at launch:\n` +
            dark.map((d) => `      - ${d.flag}=false → ${d.flow}`).join("\n") +
            "\n      Each must be an explicit decision before launch, not a default.",
  );

  add(
    {
      id: "flags.unknown-values-fail-safe",
      category: "feature-flags",
      title: "An unparseable flag value falls back to the conservative default",
      evidence: "parseBool in lib/config/featureFlags.ts; covered by executed tests",
    },
    "pass",
    "Unknown values resolve to the conservative fallback rather than enabling a flow by accident.",
  );

  /* --- durability -------------------------------------------------- */

  add(
    {
      id: "durability.memory-only-limits-documented",
      category: "durability",
      title: "The memory-only durability limits are documented and warned at boot",
      evidence: "warnIfMultiInstanceMemoryLimiter (lib/security/rateLimit.ts), called from instrumentation",
      limitation:
        "HTTP idempotency and rate limiting are process-local and do NOT survive a restart or " +
        "coordinate across instances. Cross-process correctness rests on expectedVersion " +
        "optimistic concurrency in the persistence layer, not on replay caching.",
    },
    probe.multiInstanceWarningWired ? "pass" : "fail",
    probe.multiInstanceWarningWired
      ? "The limitation is surfaced at boot. It is a documented constraint, not a solved problem."
      : "The multi-instance warning is no longer wired, so a multi-instance deploy would " +
          "silently run with per-process rate limits.",
  );

  add(
    {
      id: "durability.single-instance-deployment",
      category: "durability",
      title: "The deployment runs one instance, or accepts per-instance limits",
      evidence: "WEB_CONCURRENCY / PM2_INSTANCES as observed in the environment",
    },
    probe.instanceCount <= 1 ? "pass" : "fail",
    probe.instanceCount <= 1
      ? `Instance count is ${probe.instanceCount}; memory-only limiters are coherent.`
      : `Instance count is ${probe.instanceCount}. Rate limits and HTTP idempotency are ` +
          "per-process, so the effective rate limit is multiplied by the instance count and a " +
          "retried request can land on an instance that has never seen its idempotency key.",
  );

  /* --- database ---------------------------------------------------- */

  add(
    {
      id: "db.postgres-adapter-structure",
      category: "database",
      title: "The PostgreSQL adapter's SQL structure is verified",
      evidence: "tests/accaPostgresStructure.test.ts (executed)",
      limitation:
        "Structural verification reads the SQL. It proves shape, not behaviour: no statement in " +
        "this adapter has ever been executed against a server.",
    },
    probe.postgresStructureVerified ? "pass" : "fail",
    probe.postgresStructureVerified
      ? "The adapter's statements, columns and guards match the contract, by executed tests."
      : "The structural suite is not passing — the adapter contract is unverified.",
  );

  add(
    {
      id: "db.postgres-runtime-validated",
      category: "database",
      title: "The PostgreSQL adapter has been exercised against a real server",
      evidence:
        "Requires an executed connection. Structural tests deliberately do NOT satisfy this.",
      blocker: {
        requires: "a reachable PostgreSQL server",
        unblockedWhen:
          "a real DATABASE_URL is reachable and the adapter suite runs against it with exit code 0",
      },
    },
    probe.postgresRuntimeExecuted ? "pass" : "blocked",
    probe.postgresRuntimeExecuted
      ? "The adapter was exercised against a real server."
      : "NOT EXECUTED. Migrations, constraints, transaction semantics and concurrent conversion " +
          "behaviour are all unproven. This is the single largest unknown before launch.",
  );

  /* --- build ------------------------------------------------------- */

  add(
    {
      id: "build.production-build-executed",
      category: "build",
      title: "A full production build completes with exit code 0",
      evidence: "npm run build against a real HTTPS SITE_URL",
      blocker: {
        requires: "a real production HTTPS domain",
        unblockedWhen: "SITE_URL is a live HTTPS origin and npm run build exits 0",
      },
    },
    probe.productionBuildExecuted ? "pass" : "blocked",
    probe.productionBuildExecuted
      ? "The production build completed."
      : "NOT EXECUTED. The prepare-dev guard correctly refuses to build against a localhost " +
          "SITE_URL. A localhost build is not a substitute and must not be recorded as one.",
  );

  for (const [script, present] of Object.entries(probe.releaseScripts)) {
    add(
      {
        id: `build.script-present.${script}`,
        category: "build",
        title: `Release tooling present: ${script}`,
        evidence: `scripts/${script}`,
      },
      present ? "pass" : "fail",
      present ? `${script} is present.` : `${script} is missing — the release path has a hole.`,
    );
  }

  /* --- staging ----------------------------------------------------- */

  add(
    {
      id: "staging.smoke-executed",
      category: "staging",
      title: "Staging smoke tests pass against a deployed staging origin",
      evidence: "scripts/smoke-staging.mjs against STAGING_BASE_URL",
      blocker: {
        requires: "a deployed staging environment",
        unblockedWhen: "STAGING_BASE_URL resolves and smoke-staging exits 0",
      },
    },
    probe.stagingSmokeExecuted ? "pass" : "blocked",
    probe.stagingSmokeExecuted
      ? "Staging smoke tests passed."
      : "NOT EXECUTED. No staging environment exists and starting one is out of scope.",
  );

  return results;
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

export type LaunchSummary = {
  pass: number;
  fail: number;
  blocked: number;
  /** True only when nothing is failing AND nothing is blocked. */
  launchable: boolean;
  /** The shortest ordered list of actions that would reach launch. */
  checklist: string[];
};

export function summarise(results: readonly LaunchResult[]): LaunchSummary {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const blocked = results.filter((r) => r.status === "blocked").length;

  /*
   * The checklist is ordered by what unblocks the most downstream work, not by severity. A real
   * origin is first because the production build and staging both depend on it; failures the repo
   * can fix come last because they need no external input and can be done at any time.
   */
  const checklist: string[] = [];
  const blockedResults = results.filter((r) => r.status === "blocked");
  const order = ["env.public-origin-is-real", "db.postgres-runtime-validated", "build.production-build-executed", "staging.smoke-executed"];
  for (const id of order) {
    const r = blockedResults.find((b) => b.id === id);
    if (r?.blocker) checklist.push(`[external] ${r.blocker.requires} → ${r.blocker.unblockedWhen}`);
  }
  for (const r of blockedResults) {
    if (order.includes(r.id)) continue;
    if (r.blocker) checklist.push(`[external] ${r.blocker.requires} → ${r.blocker.unblockedWhen}`);
  }
  for (const r of results.filter((x) => x.status === "fail")) {
    checklist.push(`[repo] ${r.title}`);
  }

  return { pass, fail, blocked, launchable: fail === 0 && blocked === 0, checklist };
}
