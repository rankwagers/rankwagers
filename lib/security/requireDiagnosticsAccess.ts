import type { NextRequest } from "next/server";
import {
  diagnosticsDeniedResponse,
  evaluateDiagnosticsAccess,
} from "./diagnosticsAccess";

/** Returns a Response when access is denied; otherwise null. */
export function requireDiagnosticsAccess(
  req: NextRequest | Request
): Response | null {
  const url = "nextUrl" in req && req.nextUrl ? req.nextUrl : new URL(req.url);
  const result = evaluateDiagnosticsAccess({
    headers: req.headers,
    searchParams: url.searchParams,
  });
  if (result.allowed) return null;
  return diagnosticsDeniedResponse(result);
}
