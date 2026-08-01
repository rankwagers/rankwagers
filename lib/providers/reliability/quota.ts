import type { QuotaState } from "./types";

const quotaByProvider = new Map<string, QuotaState & { updatedAt: number }>();

/**
 * Normalize quota only from real response metadata — never invent remaining/reset.
 */
export function parseQuotaFromHeaders(headers: Headers): QuotaState {
  const remainingRaw =
    headers.get("x-ratelimit-remaining") ||
    headers.get("x-requests-remaining") ||
    headers.get("x-ratelimit-requests-remaining");
  const limitRaw =
    headers.get("x-ratelimit-limit") ||
    headers.get("x-requests-limit") ||
    headers.get("x-ratelimit-requests-limit");
  const resetRaw =
    headers.get("x-ratelimit-reset") || headers.get("x-requests-reset");

  const remaining =
    remainingRaw != null && remainingRaw !== ""
      ? Number(remainingRaw)
      : undefined;
  const limit =
    limitRaw != null && limitRaw !== "" ? Number(limitRaw) : undefined;

  let resetAt: string | undefined;
  if (resetRaw) {
    const n = Number(resetRaw);
    if (Number.isFinite(n) && n > 1_000_000_000_000) {
      resetAt = new Date(n).toISOString();
    } else if (Number.isFinite(n) && n > 1_000_000_000) {
      resetAt = new Date(n * 1000).toISOString();
    }
  }

  const hasAny =
    Number.isFinite(remaining) || Number.isFinite(limit) || Boolean(resetAt);

  if (!hasAny) {
    return { exhausted: false, source: "none" };
  }

  const exhausted =
    typeof remaining === "number" && Number.isFinite(remaining) && remaining <= 0;

  return {
    remaining: Number.isFinite(remaining) ? remaining : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    resetAt,
    exhausted,
    source: "response_header",
  };
}

export function rememberQuota(provider: string, quota: QuotaState): void {
  if (quota.source === "none") return;
  quotaByProvider.set(provider, { ...quota, updatedAt: Date.now() });
}

export function getQuota(provider: string): (QuotaState & { updatedAt: number }) | null {
  return quotaByProvider.get(provider) ?? null;
}

export function resetQuotaState(): void {
  quotaByProvider.clear();
}

export function shouldSkipForQuota(provider: string): boolean {
  const q = quotaByProvider.get(provider);
  if (!q?.exhausted) return false;
  if (q.resetAt) {
    const resetMs = Date.parse(q.resetAt);
    if (Number.isFinite(resetMs) && Date.now() >= resetMs) return false;
  }
  return true;
}
