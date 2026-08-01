import { emptySlip } from "./rules";
import {
  ACCA_STORAGE_EVENT,
  type AccaMarketKey,
  type AccaSelection,
  type AccaSlip,
  type NamedAcca,
} from "./types";
import { isAccaMarketKey } from "./markets";

const SLIP_KEY = "rankwagers:acca-slip:v1";
const NAMED_KEY = "rankwagers:acca-named:v1";
const MAX_NAMED = 24;

function emitChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACCA_STORAGE_EVENT));
}

function isSelection(value: unknown): value is AccaSelection {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.matchId === "number" &&
    typeof row.marketKey === "string" &&
    isAccaMarketKey(row.marketKey) &&
    typeof row.homeTeam === "string" &&
    typeof row.awayTeam === "string" &&
    typeof row.matchHref === "string"
  );
}

function isSlip(value: unknown): value is AccaSlip {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.locale === "string" &&
    typeof row.stake === "number" &&
    Array.isArray(row.selections) &&
    row.selections.every(isSelection)
  );
}

export function loadAccaSlip(locale: string): AccaSlip {
  if (typeof window === "undefined") return emptySlip(locale);
  try {
    const raw = window.localStorage.getItem(SLIP_KEY);
    if (!raw) return emptySlip(locale);
    const parsed = JSON.parse(raw) as unknown;
    if (!isSlip(parsed)) return emptySlip(locale);
    return { ...parsed, locale: parsed.locale || locale };
  } catch {
    return emptySlip(locale);
  }
}

export function saveAccaSlip(slip: AccaSlip): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLIP_KEY, JSON.stringify(slip));
    emitChange();
  } catch {
    // quota / private mode
  }
}

export function loadNamedAccas(): NamedAcca[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NAMED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is NamedAcca => {
      if (!row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      return (
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        typeof r.savedAt === "string" &&
        isSlip(r.slip)
      );
    });
  } catch {
    return [];
  }
}

export function saveNamedAcca(name: string, slip: AccaSlip): NamedAcca[] {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed || typeof window === "undefined") return loadNamedAccas();
  const entry: NamedAcca = {
    id: `named_${slip.id}_${Date.now().toString(36)}`,
    name: trimmed,
    slip: { ...slip, name: trimmed },
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...loadNamedAccas().filter((n) => n.name !== trimmed)].slice(
    0,
    MAX_NAMED
  );
  try {
    window.localStorage.setItem(NAMED_KEY, JSON.stringify(next));
    emitChange();
  } catch {
    // ignore
  }
  return next;
}

export function deleteNamedAcca(id: string): NamedAcca[] {
  const next = loadNamedAccas().filter((n) => n.id !== id);
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(NAMED_KEY, JSON.stringify(next));
    emitChange();
  } catch {
    // ignore
  }
  return next;
}

export function marketKeyOf(selection: AccaSelection): AccaMarketKey {
  return selection.marketKey;
}
