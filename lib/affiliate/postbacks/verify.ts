import { createHmac, timingSafeEqual } from "node:crypto";
import type { PostbackAdapterDefinition } from "./types";

export type PostbackVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Auth hooks — all adapters currently not_configured, so verification fails closed.
 */
export function verifyPostbackRequest(input: {
  adapter: PostbackAdapterDefinition;
  headers: Headers | Record<string, string | null | undefined>;
  rawBody: string;
  clientIp?: string;
}): PostbackVerifyResult {
  if (
    input.adapter.status === "disabled" ||
    input.adapter.status === "not_configured"
  ) {
    return { ok: false, reason: "not_configured" };
  }

  const header = (name: string) => {
    if (input.headers instanceof Headers) {
      return input.headers.get(name);
    }
    return input.headers[name] ?? input.headers[name.toLowerCase()] ?? null;
  };

  if (input.adapter.authMethod === "allowlisted_ip") {
    const allow = (process.env.AFFILIATE_POSTBACK_IP_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!input.clientIp || !allow.includes(input.clientIp)) {
      return { ok: false, reason: "ip_not_allowlisted" };
    }
  }

  if (input.adapter.authMethod === "shared_secret") {
    const expected = process.env[`AFFILIATE_POSTBACK_SECRET_${input.adapter.operatorId.toUpperCase().replace(/-/g, "_")}`];
    if (!expected) return { ok: false, reason: "secret_not_configured" };
    const provided = header("x-affiliate-secret") || header("authorization");
    if (!provided || provided !== expected) {
      return { ok: false, reason: "invalid_secret" };
    }
  }

  if (input.adapter.authMethod === "hmac_signature") {
    const expectedSecret = process.env[
      `AFFILIATE_POSTBACK_HMAC_${input.adapter.operatorId.toUpperCase().replace(/-/g, "_")}`
    ];
    if (!expectedSecret) return { ok: false, reason: "hmac_not_configured" };
    const provided = header("x-signature") || header("x-hub-signature-256");
    if (!provided) return { ok: false, reason: "missing_signature" };
    const digest = createHmac("sha256", expectedSecret)
      .update(input.rawBody)
      .digest("hex");
    const a = Buffer.from(digest);
    const b = Buffer.from(provided.replace(/^sha256=/, ""));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid_signature" };
    }
  }

  return { ok: true };
}
