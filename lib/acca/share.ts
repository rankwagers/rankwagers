import { getAccaMarket } from "./markets";
import { emptySlip } from "./rules";
import type { AccaSelection, AccaSharePayloadV1, AccaSlip } from "./types";
import { fixturePath } from "@/lib/fixtures/paths";

function toBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeSharePayload(slip: AccaSlip): string {
  const payload: AccaSharePayloadV1 = {
    v: 1,
    id: slip.id,
    name: slip.name,
    stake: slip.stake,
    selections: slip.selections.map((s) => ({
      matchId: s.matchId,
      marketKey: s.marketKey,
      selectionKey: s.selectionKey,
      selectionLabel: s.selectionLabel,
      homeTeam: s.homeTeam,
      awayTeam: s.awayTeam,
      competition: s.competition,
      odds: s.odds,
      confidence: s.confidence,
      kickoffAt: s.kickoffAt,
    })),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharePayload(encoded: string): AccaSharePayloadV1 | null {
  try {
    const json = fromBase64Url(encoded.trim());
    const parsed = JSON.parse(json) as AccaSharePayloadV1;
    if (parsed?.v !== 1 || !Array.isArray(parsed.selections)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function slipFromSharePayload(
  payload: AccaSharePayloadV1,
  locale: string
): AccaSlip {
  const now = new Date().toISOString();
  const base = emptySlip(locale, now);
  const selections: AccaSelection[] = payload.selections.map((row) => {
    const def = getAccaMarket(row.marketKey);
    return {
      id: `${row.matchId}:${row.marketKey}:${row.selectionKey}`,
      matchId: row.matchId,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      competition: row.competition,
      competitionSlug: null,
      countryCode: null,
      kickoffAt: row.kickoffAt,
      marketKey: row.marketKey,
      marketLabel: def.label,
      selectionLabel: row.selectionLabel,
      selectionKey: row.selectionKey,
      odds: row.odds,
      confidence: row.confidence,
      evidenceSummary: [],
      publishedAt: null,
      status: "pending",
      matchHref: fixturePath(locale, row.matchId, row.marketKey, "share"),
      source: "share",
      addedAt: now,
    };
  });
  return {
    ...base,
    id: payload.id || base.id,
    name: payload.name,
    stake: payload.stake > 0 ? payload.stake : base.stake,
    selections,
  };
}

/** Deep-link for restoring a slip — page itself stays noindex. */
export function accaSharePath(locale: string, encoded: string): string {
  return `/${locale}/acca?share=${encodeURIComponent(encoded)}`;
}

export function accaStudioPath(locale: string): string {
  return `/${locale}/acca`;
}
