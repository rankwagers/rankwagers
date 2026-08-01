import type { ComboApiResponse, PublicDiagnostics } from "./apiTypes";
import type { ComboClientSnapshot } from "./prepare";
import type { ComboMarketPreference, ComboRiskProfile, ReplacementMode } from "./types";

export type ComboFormState = {
  targetOddsMin: number;
  targetOddsMax: number;
  riskProfile: ComboRiskProfile;
  marketPreferences: ComboMarketPreference[];
  maxSelections: number;
  excludeSameCompetition: boolean;
  excludeSameCountry: boolean;
  limitSameKickoffWindow: boolean;
};

async function postJson(url: string, body: unknown): Promise<ComboApiResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as ComboApiResponse;
}

export function snapshotBody(snapshot: ComboClientSnapshot) {
  return {
    fixtures: snapshot.fixtures,
    odds: snapshot.odds,
    dataSnapshot: snapshot.snapshotId,
  };
}

export function generateComboRequest(
  form: ComboFormState,
  snapshot: ComboClientSnapshot,
  locale: string,
  country?: string
) {
  return postJson("/api/combo/generate", {
    locale,
    country,
    ...form,
    ...snapshotBody(snapshot),
  });
}

export function replaceComboRequest(input: {
  combo: unknown;
  comboId: string;
  selection: { matchId: number; marketId: string };
  mode: ReplacementMode;
  snapshot: ComboClientSnapshot;
  locale: string;
  country?: string;
}) {
  return postJson("/api/combo/replace", {
    combo: input.combo,
    comboId: input.comboId,
    selection: input.selection,
    mode: input.mode,
    locale: input.locale,
    country: input.country,
    ...snapshotBody(input.snapshot),
  });
}

export function removeComboRequest(input: {
  combo: unknown;
  comboId: string;
  selection: { matchId: number; marketId: string };
  snapshot: ComboClientSnapshot;
  locale: string;
  country?: string;
}) {
  return postJson("/api/combo/remove", {
    combo: input.combo,
    comboId: input.comboId,
    selection: input.selection,
    locale: input.locale,
    country: input.country,
    ...snapshotBody(input.snapshot),
  });
}

export async function fetchComboDiagnostics(): Promise<PublicDiagnostics> {
  const res = await fetch("/api/combo/diagnostics", { method: "GET" });
  return (await res.json()) as PublicDiagnostics;
}
