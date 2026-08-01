import type { AccaMarketKey } from "./types";

/** Stable selection id — safe for Flutter sync keys. */
export function selectionId(
  matchId: number,
  marketKey: AccaMarketKey,
  selectionKey: string
): string {
  return `${matchId}:${marketKey}:${normalizeSelectionKey(selectionKey)}`;
}

export function normalizeSelectionKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Deterministic slip id from selection ids + createdAt bucket (share-stable when decoded). */
export function buildSlipId(selectionIds: readonly string[], createdAt: string): string {
  const body = [...selectionIds].sort().join("|");
  let hash = 2166136261;
  const input = `${body}#${createdAt.slice(0, 16)}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `acca_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function newClientSlipId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `acca_${Date.now().toString(36)}_${rand}`;
}
