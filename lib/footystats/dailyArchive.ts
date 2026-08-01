import fs from "fs/promises";
import path from "path";
import { isMatchPostponed } from "./matchStatus";
import { isPredictionWin } from "./predictionWin";
import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "./types";

const ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives");

/**
 * Canonical daily-archive directory. Exported so a reader outside this module resolves the same
 * location instead of re-deriving the path and drifting from it.
 */
export function dailyArchiveDir(): string {
  return ARCHIVE_DIR;
}

export type ArchivedRow = FootyMatchRow & {
  listResult: "won" | "lost" | "pending" | "postponed";
};

export type DailyArchive = {
  date: string;
  savedAt: string;
  summary: Record<MatchListKind, { total: number; won: number; lost: number; pending: number; postponed: number }>;
  fh: ArchivedRow[];
  over15: ArchivedRow[];
  over25: ArchivedRow[];
  sh: ArchivedRow[];
};

function rowResult(row: FootyMatchRow, tab: MatchListKind): ArchivedRow["listResult"] {
  if (isMatchPostponed(row.status)) return "postponed";
  if (!row.isFinished) return "pending";
  return isPredictionWin(row, tab) ? "won" : "lost";
}

function archiveRows(rows: FootyMatchRow[], tab: MatchListKind): ArchivedRow[] {
  return rows.map((r) => ({ ...r, listResult: rowResult(r, tab) }));
}

function buildSummary(lists: DailyMatchLists): DailyArchive["summary"] {
  const tabs: MatchListKind[] = ["fh", "over15", "over25", "sh"];
  const summary = {} as DailyArchive["summary"];
  for (const tab of tabs) {
    const rows = lists[tab];
    let won = 0;
    let lost = 0;
    let pending = 0;
    let postponed = 0;
    for (const r of rows) {
      const res = rowResult(r, tab);
      if (res === "won") won++;
      else if (res === "lost") lost++;
      else if (res === "postponed") postponed++;
      else pending++;
    }
    summary[tab] = { total: rows.length, won, lost, pending, postponed };
  }
  return summary;
}

export async function saveDailyArchive(lists: DailyMatchLists): Promise<void> {
  const archive: DailyArchive = {
    date: lists.date,
    savedAt: new Date().toISOString(),
    summary: buildSummary(lists),
    fh: archiveRows(lists.fh, "fh"),
    over15: archiveRows(lists.over15, "over15"),
    over25: archiveRows(lists.over25, "over25"),
    sh: archiveRows(lists.sh, "sh"),
  };
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const file = path.join(ARCHIVE_DIR, `${lists.date}.json`);
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(archive), "utf-8");
  await fs.rename(tmp, file);
}

/**
 * FAIL-OPEN daily-archive reader. Resolves `null` when the archive cannot be read for ANY
 * reason: a legitimately-absent partition (ENOENT) AND a fault (malformed JSON, IO error) both
 * collapse to `null` — the bare `catch` cannot tell them apart. Behaviour is intentionally
 * unchanged. Callers that must distinguish "absent" from "faulted" use
 * {@link readDailyArchiveStrict} instead. (Dual-reader pair — M10 Stage 2E Slice 3.)
 */
export async function readDailyArchive(date: string): Promise<DailyArchive | null> {
  const file = path.join(ARCHIVE_DIR, `${date}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as DailyArchive;
  } catch {
    return null;
  }
}

/**
 * STRICT daily-archive reader — M10 Stage 2E Slice 3 (additive, dormant: zero production
 * callers). The disambiguating sibling of the fail-open {@link readDailyArchive}: it separates
 * the two cases the fail-open reader collapses to `null`.
 *
 * Contract (storage-independent): `absent → null` · `fault → throw` · `valid non-array object →
 * return`. Filesystem semantics:
 *   - partition absent (ENOENT) → resolves `null` (the SOLE meaning of `null` here);
 *   - malformed JSON, empty file, parsed `null`, parsed primitive, or parsed array → THROWS;
 *   - any non-ENOENT filesystem error (EISDIR, EACCES, …) → THROWS;
 *   - parsed non-null, non-array object → returns it as `DailyArchive`.
 *
 * "Valid" means ONLY that the file parsed to a non-null, non-array object — NO deep
 * `DailyArchive` schema validation is performed (deferred to a later stage). Every fault throw
 * preserves the original error as `cause` (filesystem `code` recoverable through it); no custom
 * error class, no logging. Performs exactly one async read + one JSON parse — no pre-stat, no
 * `fs.access`, no retry, no copy, no cache. `archiveDir` defaults to the production archive
 * directory and exists solely for hermetic testing / future controlled composition; it adds no
 * production or import-time IO.
 */
export async function readDailyArchiveStrict(
  date: string,
  archiveDir: string = ARCHIVE_DIR,
): Promise<DailyArchive | null> {
  const file = path.join(archiveDir, `${date}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw new Error(`readDailyArchiveStrict: read failed for ${date}`, { cause: err });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`readDailyArchiveStrict: malformed JSON for ${date}`, { cause: err });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`readDailyArchiveStrict: archive for ${date} is not a non-array object`);
  }
  return parsed as DailyArchive;
}

export function archiveToDailyLists(archive: DailyArchive): DailyMatchLists {
  return {
    date: archive.date,
    fh: archive.fh,
    over15: archive.over15,
    over25: archive.over25,
    sh: archive.sh,
    fetchedAt: archive.savedAt,
  };
}

/** Biten maçlar varsa arşivi güncelle (bugün veya geçmiş gün). */
export async function mergeArchiveFromLists(lists: DailyMatchLists): Promise<void> {
  const hasFinished = [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh].some(
    (r) => r.isFinished
  );
  if (!hasFinished) return;
  await saveDailyArchive(lists);
}
