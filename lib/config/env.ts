/**
 * Typed runtime config with fail-fast rules for staging/production.
 * Never invent a public canonical host (especially not example.com).
 */

export type AppEnv = "development" | "test" | "staging" | "production";

const LOCALHOST_RE = /localhost|127\.0\.0\.1/i;
const FORBIDDEN_PROD_HOSTS = new Set([
  "example.com",
  "www.example.com",
  "your-domain.com",
  "www.your-domain.com",
]);

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvConfigError";
  }
}

export function resolveAppEnv(): AppEnv {
  const explicit = process.env.APP_ENV?.trim().toLowerCase();
  if (
    explicit === "development" ||
    explicit === "test" ||
    explicit === "staging" ||
    explicit === "production"
  ) {
    return explicit;
  }
  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isDeployedEnv(appEnv: AppEnv = resolveAppEnv()): boolean {
  return appEnv === "staging" || appEnv === "production";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function assertValidAbsoluteOrigin(raw: string, appEnv: AppEnv): string {
  const origin = stripTrailingSlash(raw.trim());
  if (!origin) {
    throw new EnvConfigError("SITE_URL is empty after trim");
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new EnvConfigError(`SITE_URL is not a valid absolute URL: ${raw}`);
  }

  if (url.pathname && url.pathname !== "/") {
    throw new EnvConfigError("SITE_URL must be an origin only (no path)");
  }
  if (url.search || url.hash) {
    throw new EnvConfigError("SITE_URL must be an origin only (no query/hash)");
  }

  const host = url.hostname.toLowerCase();
  if (FORBIDDEN_PROD_HOSTS.has(host)) {
    throw new EnvConfigError(
      `SITE_URL host "${host}" is a forbidden placeholder — set the real public origin`
    );
  }

  if (isDeployedEnv(appEnv)) {
    if (LOCALHOST_RE.test(host)) {
      throw new EnvConfigError(
        `SITE_URL must not be localhost in ${appEnv}`
      );
    }
    if (url.protocol !== "https:") {
      throw new EnvConfigError(
        `SITE_URL must use https:// in ${appEnv} (got ${url.protocol})`
      );
    }
  }

  return `${url.protocol}//${url.host}`;
}

/**
 * Public site origin (no trailing slash).
 * - development/test: defaults to http://localhost:3000 when unset
 * - staging/production: SITE_URL required; invalid/missing → throw
 */
export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const appEnv = (() => {
    const explicit = env.APP_ENV?.trim().toLowerCase();
    if (
      explicit === "development" ||
      explicit === "test" ||
      explicit === "staging" ||
      explicit === "production"
    ) {
      return explicit as AppEnv;
    }
    if (env.NODE_ENV === "test") return "test" as AppEnv;
    if (env.NODE_ENV === "production") return "production" as AppEnv;
    return "development" as AppEnv;
  })();

  const raw = env.SITE_URL?.trim() ?? "";
  if (!raw) {
    if (isDeployedEnv(appEnv)) {
      throw new EnvConfigError(
        `SITE_URL is required in ${appEnv} (no placeholder fallback)`
      );
    }
    return "http://localhost:3000";
  }

  return assertValidAbsoluteOrigin(raw, appEnv);
}

export type EnvValidationResult = {
  ok: boolean;
  appEnv: AppEnv;
  errors: string[];
  warnings: string[];
};

const WEAK_SECRETS = new Set([
  "",
  "admin",
  "change-this-secret-key",
  "change-me",
  "secret",
  "password",
  "dev-only-redirect-secret-change-me",
  "cron-secret-at-least-16",
]);

const WEAK_SUBSTRINGS = [
  "example",
  "placeholder",
  "changeme",
  "change-me",
  "your-",
  "todo",
  "xxx",
];

function secretValue(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    const v = c?.trim() ?? "";
    if (v) return v;
  }
  return "";
}

/** Returns true when a secret looks weak. Never echoes the secret value. */
export function isInsecureSecret(value: string, minLength = 16): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v.length < minLength) return true;
  if (WEAK_SECRETS.has(v)) return true;
  const lower = v.toLowerCase();
  if (WEAK_SUBSTRINGS.some((s) => lower.includes(s))) return true;
  return false;
}

function assertDistinctSecrets(
  pairs: Array<[string, string]>,
  errors: string[]
): void {
  const seen = new Map<string, string>();
  for (const [name, value] of pairs) {
    if (!value) continue;
    const prev = seen.get(value);
    if (prev && prev !== name) {
      errors.push(`${name} must not equal ${prev}`);
    } else {
      seen.set(value, name);
    }
  }
}

/** Validate env for the current APP_ENV / NODE_ENV. Safe to call at startup. */
export function validateRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env
): EnvValidationResult {
  const appEnv = (() => {
    const explicit = env.APP_ENV?.trim().toLowerCase();
    if (
      explicit === "development" ||
      explicit === "test" ||
      explicit === "staging" ||
      explicit === "production"
    ) {
      return explicit as AppEnv;
    }
    if (env.NODE_ENV === "test") return "test" as AppEnv;
    if (env.NODE_ENV === "production") return "production" as AppEnv;
    return "development" as AppEnv;
  })();

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    resolveSiteUrl(env);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  if (isDeployedEnv(appEnv)) {
    const redirectSecret = secretValue(
      env.AFFILIATE_REDIRECT_SECRET,
      env.ANALYTICS_SIGNING_SECRET
    );
    if (isInsecureSecret(redirectSecret)) {
      errors.push(
        "AFFILIATE_REDIRECT_SECRET must be a strong non-default value in staging/production"
      );
    }

    const previous = secretValue(env.AFFILIATE_REDIRECT_PREVIOUS_SECRET);
    if (previous && isInsecureSecret(previous)) {
      errors.push(
        "AFFILIATE_REDIRECT_PREVIOUS_SECRET is set but insecure — omit or use a strong value"
      );
    }

    const adminKey = secretValue(env.ADMIN_KEY);
    if (isInsecureSecret(adminKey)) {
      errors.push("ADMIN_KEY must be a strong non-default value in staging/production");
    }

    const diagnostics = secretValue(
      env.DIAGNOSTICS_SECRET,
      env.ADMIN_KEY
    );
    if (
      (env.ENABLE_DIAGNOSTICS === "true" ||
        env.ENABLE_DEVELOPER_TOOLS === "true") &&
      isInsecureSecret(diagnostics)
    ) {
      errors.push(
        "DIAGNOSTICS_SECRET/ADMIN_KEY must be strong when diagnostics are enabled"
      );
    }

    const cronSecret = secretValue(env.CRON_SECRET, env.INTERNAL_CRON_SECRET);
    if (
      (env.ENABLE_CRON === "true" || env.ENABLE_CRON === "1") &&
      isInsecureSecret(cronSecret)
    ) {
      errors.push("CRON_SECRET must be strong when ENABLE_CRON is true");
    }

    assertDistinctSecrets(
      [
        ["AFFILIATE_REDIRECT_SECRET", redirectSecret],
        ["ADMIN_KEY", adminKey],
        ["CRON_SECRET", cronSecret],
        ["DIAGNOSTICS_SECRET", secretValue(env.DIAGNOSTICS_SECRET)],
      ],
      errors
    );

    const dbUrl = secretValue(
      env.ATTRIBUTION_DATABASE_URL,
      env.ODDS_HISTORY_DATABASE_URL
    );
    if (!dbUrl) {
      warnings.push(
        "ATTRIBUTION_DATABASE_URL / ODDS_HISTORY_DATABASE_URL unset — attribution uses memory (process-local)"
      );
    }
  }

  return { ok: errors.length === 0, appEnv, errors, warnings };
}

/** Throw if staging/production env is invalid. No-op in development/test. */
export function assertRuntimeEnvOrThrow(
  env: NodeJS.ProcessEnv = process.env
): void {
  const result = validateRuntimeEnv(env);
  if (!isDeployedEnv(result.appEnv)) return;
  if (result.ok) return;
  throw new EnvConfigError(
    `Invalid ${result.appEnv} environment:\n- ${result.errors.join("\n- ")}`
  );
}
