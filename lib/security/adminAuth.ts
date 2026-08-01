/**
 * Admin authentication — Bearer or opaque HttpOnly session cookie.
 * Query-string secrets are never accepted.
 */

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  isDeployedEnv,
  isInsecureSecret,
  resolveAppEnv,
  type AppEnv,
} from "@/lib/config/env";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { checkRateLimitSafe, clientKey } from "@/lib/security/rateLimit";

function appEnvFrom(env: NodeJS.ProcessEnv): AppEnv {
  const explicit = env.APP_ENV?.trim().toLowerCase();
  if (
    explicit === "development" ||
    explicit === "test" ||
    explicit === "staging" ||
    explicit === "production"
  ) {
    return explicit;
  }
  if (env.NODE_ENV === "test") return "test";
  if (env.NODE_ENV === "production") return "production";
  return resolveAppEnv();
}

export const ADMIN_COOKIE = "rw_admin_session";
/** Root path so /admin page and /api/admin/* login/logout share the cookie. */
export const ADMIN_COOKIE_PATH = "/";
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12h

export type AdminAuthResult =
  | { ok: true; via: "bearer" | "cookie" }
  | {
      ok: false;
      code:
        | "route_disabled"
        | "authentication_required"
        | "forbidden"
        | "rate_limited"
        | "insecure_admin_secret";
      status: 401 | 403 | 404 | 429;
    };

function adminSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.ADMIN_KEY?.trim() || "";
}

/** Constant-time string compare via SHA-256 digests. */
export function safeEqualSecret(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(value: string): Buffer {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

/** Opaque signed session cookie (does not store raw ADMIN_KEY). */
export function mintAdminSession(
  secret: string = adminSecret(),
  now = Date.now()
): string {
  const exp = now + ADMIN_SESSION_MAX_AGE_SEC * 1000;
  const nonce = randomBytes(16).toString("hex");
  const body = `${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(body).digest();
  return `s1.${body}.${b64url(sig)}`;
}

export function verifyAdminSession(
  cookieValue: string | undefined | null,
  secret: string = adminSecret(),
  now = Date.now()
): boolean {
  if (!cookieValue || !secret) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 4 || parts[0] !== "s1") return false;
  const [, expRaw, nonce, sigB64] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return false;
  if (!nonce || nonce.length < 16) return false;
  const body = `${expRaw}.${nonce}`;
  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try {
    provided = fromB64url(sigB64);
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function bearerToken(headers: Headers): string | null {
  const raw = headers.get("authorization") || headers.get("Authorization");
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || null;
}

export function evaluateAdminAccess(input: {
  headers: Headers;
  cookieValue?: string | null;
  /** Ignored — query keys are never accepted. */
  searchParams?: URLSearchParams;
  clientKey?: string;
  env?: NodeJS.ProcessEnv;
}): AdminAuthResult {
  const env = input.env ?? process.env;
  const flags = getFeatureFlags(env);
  if (
    env.FF_ADMIN_ENABLED === "false" ||
    env.FF_ADMIN_ENABLED === "0" ||
    env.FF_EMERGENCY_DISABLE_ADMIN === "true"
  ) {
    return { ok: false, code: "route_disabled", status: 404 };
  }
  // Optional explicit disable via feature flag module if present later.
  void flags;

  const appEnv = appEnvFrom(env);
  const deployed = isDeployedEnv(appEnv);
  const secret = adminSecret(env);
  if (!secret || (deployed && isInsecureSecret(secret))) {
    return {
      ok: false,
      code: "insecure_admin_secret",
      status: deployed ? 403 : 401,
    };
  }

  const rl = checkRateLimitSafe({
    key: `admin:${input.clientKey || "anon"}`,
    limit: 30,
    windowMs: 60_000,
    route: "admin",
    onAdapterFailure: "fail_closed",
  });
  if (!rl.allowed) {
    return { ok: false, code: "rate_limited", status: 429 };
  }

  const bearer = bearerToken(input.headers);
  if (bearer && safeEqualSecret(bearer, secret)) {
    return { ok: true, via: "bearer" };
  }

  if (verifyAdminSession(input.cookieValue, secret)) {
    return { ok: true, via: "cookie" };
  }

  return { ok: false, code: "authentication_required", status: 401 };
}

export function adminCookieOptions(
  maxAge = ADMIN_SESSION_MAX_AGE_SEC,
  env: NodeJS.ProcessEnv = process.env
): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  const deployed = isDeployedEnv(appEnvFrom(env));
  return {
    httpOnly: true,
    secure: deployed || env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADMIN_COOKIE_PATH,
    maxAge,
  };
}

export { clientKey };
