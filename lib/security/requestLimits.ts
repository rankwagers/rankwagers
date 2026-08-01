import type { NextRequest } from "next/server";
import { securityErrorResponse } from "./errors";

export const BODY_LIMITS = {
  comboApi: 256 * 1024,
  accaBuilderApi: 64 * 1024,
  postback: 64 * 1024,
  cron: 4 * 1024,
  defaultJson: 128 * 1024,
} as const;

const MAX_URL_LENGTH = 2048;

export function assertSafeUrlLength(url: string): Response | null {
  if (url.length > MAX_URL_LENGTH) {
    return securityErrorResponse("invalid_request", 414);
  }
  return null;
}

export async function readJsonBody(
  req: NextRequest | Request,
  limitBytes: number
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: securityErrorResponse("invalid_content_type", 415),
    };
  }

  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader) {
    const n = Number(lengthHeader);
    if (Number.isFinite(n) && n > limitBytes) {
      return {
        ok: false,
        response: securityErrorResponse("payload_too_large", 413, {
          limitBytes,
        }),
      };
    }
  }

  const raw = await req.text();
  if (raw.length > limitBytes) {
    return {
      ok: false,
      response: securityErrorResponse("payload_too_large", 413, {
        limitBytes,
      }),
    };
  }

  if (!raw.trim()) {
    return { ok: true, body: {} };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        response: securityErrorResponse("invalid_request", 400),
      };
    }
    // Shallow prototype-pollution guard
    if (Object.prototype.hasOwnProperty.call(parsed, "__proto__")) {
      return {
        ok: false,
        response: securityErrorResponse("invalid_request", 400),
      };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: securityErrorResponse("invalid_request", 400),
    };
  }
}
