/**
 * Same-day archive fallback (incident 2026-08-01).
 *
 * Today's list path called the provider and, when that call failed, returned an empty day — while a
 * valid archive of the same day sat on disk holding the last successful capture. The provider was
 * unavailable for 26 minutes and the product went blank rather than degrading.
 *
 * This module answers exactly one question: *may today's stored archive stand in for a failed live
 * fetch, and if so with what provenance?* It changes no qualification rule, no normalization, no
 * historical-date behaviour, and it never runs when the provider succeeded — including when the
 * provider succeeded with an empty day, which is a fact about football, not a failure.
 *
 * Validation is fail-closed: anything that is not a well-formed, in-date, non-empty archive is
 * rejected and the caller falls through to the unavailable state. A wrong answer here would put
 * yesterday's fixtures under today's date, which is worse than an empty page.
 */

import { promises as fs } from "fs";
import path from "path";
import {
  archiveToDailyLists,
  dailyArchiveDir,
  type DailyArchive,
} from "./dailyArchive";
import type {
  DailyListsProvenance,
  DailyMatchLists,
  FootyMatchRow,
  MatchListKind,
} from "./types";

const LIST_KINDS: readonly MatchListKind[] = ["fh", "over15", "over25", "sh"];

/** Why a candidate archive was refused. Bounded set — safe as a log label. */
export type ArchiveRejectionCode =
  | "absent"
  | "unreadable"
  | "date_mismatch"
  | "no_valid_fixture";

export type ArchiveAcceptance =
  | { accepted: true; archive: DailyArchive }
  | { accepted: false; code: ArchiveRejectionCode };

/**
 * A row is usable only if it can survive the rest of the pipeline: a positive integer id and two
 * named teams. This is the same minimum the daily-list mapper enforces downstream — checked here so
 * an archive of structurally broken rows is refused outright rather than qualifying to zero.
 */
function isValidFixtureRow(row: unknown): row is FootyMatchRow {
  if (!row || typeof row !== "object") return false;
  const r = row as Partial<FootyMatchRow>;
  return (
    typeof r.matchId === "number" &&
    Number.isInteger(r.matchId) &&
    r.matchId > 0 &&
    typeof r.homeTeam === "string" &&
    r.homeTeam.trim().length > 0 &&
    typeof r.awayTeam === "string" &&
    r.awayTeam.trim().length > 0
  );
}

/** Count of rows across all four lists that could survive the pipeline. */
export function countValidFixtures(archive: DailyArchive): number {
  let valid = 0;
  for (const kind of LIST_KINDS) {
    const rows = archive[kind];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) if (isValidFixtureRow(row)) valid += 1;
  }
  return valid;
}

/**
 * Pure acceptance rule. No I/O, no clock — the caller supplies the parsed archive.
 *
 * Accepts only a non-null object whose `date` equals the requested date and which carries at least
 * one structurally valid fixture. A malformed or partially written file never reaches here — the
 * strict read refuses it first and reports `unreadable`.
 */
export function acceptSameDayArchive(
  archive: DailyArchive | null,
  requestedDate: string
): ArchiveAcceptance {
  if (!archive || typeof archive !== "object") {
    return { accepted: false, code: "absent" };
  }
  if (archive.date !== requestedDate) {
    return { accepted: false, code: "date_mismatch" };
  }
  if (countValidFixtures(archive) < 1) {
    return { accepted: false, code: "no_valid_fixture" };
  }
  return { accepted: true, archive };
}

/** Whole seconds between the archive's capture instant and now. Negative clamps to 0. */
export function archiveAgeSeconds(savedAt: string, nowMs: number): number | undefined {
  const saved = Date.parse(savedAt);
  if (Number.isNaN(saved)) return undefined;
  return Math.max(0, Math.floor((nowMs - saved) / 1000));
}

/**
 * Strict archive read, local to the fallback on purpose.
 *
 * A disambiguating reader already exists in `dailyArchive`, but the M10 Stage 2E plan ships it with
 * a deliberate zero-production-caller invariant until its own stage is authorized. An emergency
 * hotfix must not activate a component another milestone is holding dormant, so the ~15 lines are
 * restated here and that boundary stays intact.
 *
 * Absent file is `absent`; every other fault — malformed JSON, truncated write, empty file, wrong
 * root type, IO error — is `unreadable`. The two are never collapsed: a corrupt archive must be
 * refused in the provenance rather than mistaken for a day we never captured.
 */
async function readArchiveStrictly(
  requestedDate: string,
  archiveDir?: string
): Promise<{ archive: DailyArchive | null; code?: ArchiveRejectionCode }> {
  const file = path.join(archiveDir ?? dailyArchiveDir(), `${requestedDate}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { archive: null, code: "absent" };
    }
    return { archive: null, code: "unreadable" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { archive: null, code: "unreadable" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { archive: null, code: "unreadable" };
  }
  return { archive: parsed as DailyArchive };
}

export type SameDayFallback =
  | { used: true; lists: DailyMatchLists }
  | { used: false; code: ArchiveRejectionCode };

/**
 * Load today's archive as a stand-in for a failed live fetch.
 *
 * Reads strictly on purpose. The fail-open reader used elsewhere collapses "no archive for this
 * date" and "the archive is corrupt" into the same `null`, and those must not be the same decision
 * here — a corrupt file has to be refused loudly in the provenance rather than silently treated as
 * an absent one.
 *
 * `archiveDir` and `nowMs` are injected for hermetic tests; production passes neither.
 */
export async function loadSameDayArchiveFallback(
  requestedDate: string,
  providerFailureReasonCode: string,
  options: { archiveDir?: string; nowMs?: number } = {}
): Promise<SameDayFallback> {
  const read = await readArchiveStrictly(requestedDate, options.archiveDir);
  if (read.code) return { used: false, code: read.code };

  const acceptance = acceptSameDayArchive(read.archive, requestedDate);
  if (!acceptance.accepted) return { used: false, code: acceptance.code };

  const archive = acceptance.archive;
  const provenance: DailyListsProvenance = {
    source: "stale_daily_archive",
    requestedDate,
    archiveCapturedAt: archive.savedAt,
    providerFailureReasonCode,
  };
  const age = archiveAgeSeconds(archive.savedAt, options.nowMs ?? Date.now());
  if (age !== undefined) provenance.archiveAgeSeconds = age;

  // Reuses the existing archive→lists projection, so the rows entering normalization and
  // qualification are byte-identical to the historical-date path.
  return { used: true, lists: { ...archiveToDailyLists(archive), provenance } };
}
