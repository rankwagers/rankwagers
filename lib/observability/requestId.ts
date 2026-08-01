/**
 * Opaque request correlation IDs for logs and response headers.
 * Never embed PII or secrets.
 */

const REQUEST_ID_HEADER = "x-request-id";

export function requestIdHeaderName(): string {
  return REQUEST_ID_HEADER;
}

/** Accept inbound id when well-formed; otherwise mint a new one. */
export function resolveRequestId(inbound: string | null | undefined): string {
  const trimmed = inbound?.trim() ?? "";
  if (/^[A-Za-z0-9._-]{8,128}$/.test(trimmed)) return trimmed;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `req_${rand}`;
}

export function readRequestIdFromHeaders(
  headers: Headers | { get(name: string): string | null }
): string {
  return resolveRequestId(headers.get(REQUEST_ID_HEADER));
}
