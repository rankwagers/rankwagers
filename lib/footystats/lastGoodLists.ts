/**
 * Last-good daily lists — the display fallback of last resort.
 *
 * WHY THIS EXISTS. The same-day archive fallback only helps once a day's archive exists, and
 * `mergeArchiveFromLists` writes that archive only after one of the day's fixtures has FINISHED.
 * So a provider outage in the MORNING had nothing to fall back to and the homepage went empty —
 * the archive fallback cannot cover the window before the first match ends.
 *
 * WHAT THIS IS NOT. It is not a data source. Capture keeps its fail-closed live-only source
 * (`assertLiveSource` accepts `fresh_provider` and nothing else, so a `last_good` serving is
 * refused there by construction). This layer exists so a READER sees the last real board we held
 * instead of a blank page, with the time it was retrieved stated on the page.
 *
 * SAME-DAY ONLY. A snapshot is keyed by date and is served only for its own date. Yesterday's
 * lists never wear today's date — the same principle capture enforces, for the same reason: a
 * board whose kickoffs have already passed is worse than no board.
 *
 * Server-only: touches the filesystem.
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { DailyListsProvenance, DailyMatchLists } from "./types";

/**
 * Shared, not release-local: the snapshot must survive a deploy swap, which is precisely when a
 * cold cache makes an outage most likely to show.
 */
const SHARED_DEFAULT_DIR = "/opt/rankwagers/shared/daily-lists-last-good";

export function lastGoodDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.DAILY_LISTS_LAST_GOOD_DIR?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") return SHARED_DEFAULT_DIR;
  return path.join(process.cwd(), "data", "daily-lists-last-good");
}

function snapshotPath(date: string, env?: NodeJS.ProcessEnv): string {
  return path.join(lastGoodDir(env), `${date}.json`);
}

/** A date we are willing to key a file by. Guards against a path fragment reaching the filename. */
function isPlainDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Overwrite the snapshot for a date after a successful fetch.
 *
 * Never throws: a snapshot that fails to persist must not fail the request that produced it. The
 * write is atomic (temp + rename) so a crash mid-write cannot leave a half-written file that the
 * reader would then refuse — which would silently disable the fallback exactly when it matters.
 */
export async function saveLastGoodLists(
  lists: DailyMatchLists,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  if (!isPlainDate(lists.date)) return;
  try {
    const dir = lastGoodDir(env);
    await fs.mkdir(dir, { recursive: true });
    const file = snapshotPath(lists.date, env);
    const tmp = `${file}.tmp`;
    // `provenance` is deliberately NOT stored. It describes how THIS response was obtained; the
    // serving path stamps its own. `researchRun` and `fetchedAt` are stored verbatim — they are
    // what makes the served snapshot honest about when it was true.
    const { provenance: _provenance, ...rest } = lists;
    await fs.writeFile(tmp, JSON.stringify(rest), "utf8");
    await fs.rename(tmp, file);
  } catch {
    // Intentionally silent. The caller is serving a good response; a failed cache write is not
    // its problem, and throwing here would turn a success into a failure.
  }
}

export type LastGoodResult =
  | { used: false; reason: "missing" | "unreadable" | "wrong_date" | "empty" }
  | { used: true; lists: DailyMatchLists };

/**
 * Read the snapshot for a date, if one exists and is usable for THAT date.
 *
 * Refuses rather than repairs. A snapshot whose stored date does not match the requested date is
 * rejected outright — that is the one failure mode that would put stale fixtures under today's
 * heading, and no amount of provenance labelling makes that acceptable.
 */
export async function loadLastGoodLists(
  date: string,
  failureReasonCode: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<LastGoodResult> {
  if (!isPlainDate(date)) return { used: false, reason: "wrong_date" };

  let raw: string;
  try {
    raw = await fs.readFile(snapshotPath(date, env), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return { used: false, reason: code === "ENOENT" ? "missing" : "unreadable" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { used: false, reason: "unreadable" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { used: false, reason: "unreadable" };
  }

  const snapshot = parsed as DailyMatchLists;
  // The filename is not trusted on its own: the stored date must agree with it.
  if (snapshot.date !== date) return { used: false, reason: "wrong_date" };

  const rows =
    (snapshot.fh?.length ?? 0) +
    (snapshot.over15?.length ?? 0) +
    (snapshot.over25?.length ?? 0) +
    (snapshot.sh?.length ?? 0);
  // A stored empty day is indistinguishable from no help at all; let the empty-day copy stand.
  if (rows === 0) return { used: false, reason: "empty" };

  const provenance: DailyListsProvenance = {
    source: "last_good",
    requestedDate: date,
    providerFailureReasonCode: failureReasonCode,
  };

  // `fetchedAt` is carried through UNCHANGED. The page prints "Lists retrieved HH:MM UTC" from it,
  // and that line is the whole honesty mechanism — restamping it to now would make the page claim
  // a freshness it does not have.
  return { used: true, lists: { ...snapshot, provenance } };
}
