export type SecurityErrorCode =
  | "route_disabled"
  | "authentication_required"
  | "forbidden"
  | "invalid_internal_secret"
  | "rate_limited"
  | "method_not_allowed"
  | "payload_too_large"
  | "invalid_content_type"
  | "invalid_request";

export function securityErrorResponse(
  code: SecurityErrorCode,
  status: number,
  extras?: Record<string, unknown>
): Response {
  return Response.json(
    { error: code, ...extras },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    }
  );
}
