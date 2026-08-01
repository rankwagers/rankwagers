import "server-only";

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export type RedirectContext = {
  operatorId: string;
  comboId?: string;
  country?: string;
  locale?: string;
  placement?: string;
  operatorRank?: number;
  availability?: "full" | "partial" | "unknown" | "none";
  deeplinkType?: string;
  selectionCount?: number;
  targetOddsMin?: number;
  targetOddsMax?: number;
  actualComboOdds?: number;
  operatorComboOdds?: number;
  evidenceStrength?: string;
  marketTypes?: string[];
  offerId?: string;
  sessionId?: string;
  issuedAt: number;
  expiresAt: number;
  /** Token format version */
  v?: number;
};

const TOKEN_VERSION = "r2";
const LEGACY_VERSION = "r1";

function ttlMs(): number {
  const sec = Number(process.env.AFFILIATE_REDIRECT_TOKEN_TTL_SECONDS ?? "");
  if (Number.isFinite(sec) && sec > 0 && sec <= 3600) {
    return Math.floor(sec * 1000);
  }
  return 15 * 60 * 1000;
}

function activeSecret(): string {
  return (
    process.env.AFFILIATE_REDIRECT_SECRET?.trim() ||
    process.env.ANALYTICS_SIGNING_SECRET?.trim() ||
    "dev-only-redirect-secret-change-me"
  );
}

function verificationSecrets(): string[] {
  const active = activeSecret();
  const previous = process.env.AFFILIATE_REDIRECT_PREVIOUS_SECRET?.trim() || "";
  const list = [active];
  if (previous && previous !== active) list.push(previous);
  return list;
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b
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

function hmac(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

function signaturesMatch(provided: Buffer, expected: Buffer): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Opaque HMAC-signed short-lived redirect context. No destination URL inside. */
export function signRedirectContext(
  input: Omit<RedirectContext, "issuedAt" | "expiresAt" | "v"> & {
    ttlMs?: number;
    now?: number;
  }
): string {
  const issuedAt = input.now ?? Date.now();
  const expiresAt = issuedAt + (input.ttlMs ?? ttlMs());
  const payload: RedirectContext = {
    operatorId: input.operatorId,
    comboId: input.comboId,
    country: input.country,
    locale: input.locale,
    placement: input.placement,
    operatorRank: input.operatorRank,
    availability: input.availability,
    deeplinkType: input.deeplinkType,
    selectionCount: input.selectionCount,
    targetOddsMin: input.targetOddsMin,
    targetOddsMax: input.targetOddsMax,
    actualComboOdds: input.actualComboOdds,
    operatorComboOdds: input.operatorComboOdds,
    evidenceStrength: input.evidenceStrength,
    marketTypes: input.marketTypes,
    offerId: input.offerId,
    sessionId: input.sessionId,
    issuedAt,
    expiresAt,
    v: 2,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = hmac(activeSecret(), body);
  const nonce = b64url(randomBytes(8));
  return `${TOKEN_VERSION}.${body}.${b64url(sig)}.${nonce}`;
}

export type RedirectTokenResult =
  | { ok: true; context: RedirectContext }
  | {
      ok: false;
      reason:
        | "malformed"
        | "tampered"
        | "expired"
        | "operator_mismatch"
        | "unsupported_version";
    };

export function verifyRedirectToken(
  token: string,
  expectedOperatorId?: string,
  now = Date.now()
): RedirectTokenResult {
  if (!token || token.length > 4096) {
    return { ok: false, reason: "malformed" };
  }
  // Reject CR/LF / header-injection vectors early.
  if (/[\r\n\0]/.test(token)) {
    return { ok: false, reason: "malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return { ok: false, reason: "malformed" };
  }
  const [version, body, sigB64] = parts;
  if (version !== TOKEN_VERSION && version !== LEGACY_VERSION) {
    return { ok: false, reason: "unsupported_version" };
  }

  let provided: Buffer;
  try {
    provided = fromB64url(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  let matched = false;
  for (const secret of verificationSecrets()) {
    const expected = hmac(secret, body);
    if (signaturesMatch(provided, expected)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    return { ok: false, reason: "tampered" };
  }

  let context: RedirectContext;
  try {
    context = JSON.parse(fromB64url(body).toString("utf8")) as RedirectContext;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!context.operatorId || !context.expiresAt || !context.issuedAt) {
    return { ok: false, reason: "malformed" };
  }
  // Bound verification window: reject tokens issued too far in the future / past TTL*2
  if (context.issuedAt > now + 60_000) {
    return { ok: false, reason: "malformed" };
  }
  if (now > context.expiresAt) {
    return { ok: false, reason: "expired" };
  }
  if (expectedOperatorId && context.operatorId !== expectedOperatorId) {
    return { ok: false, reason: "operator_mismatch" };
  }
  return { ok: true, context };
}
