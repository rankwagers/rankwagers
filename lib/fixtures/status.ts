import { isMatchPostponed } from "@/lib/footystats/matchStatus";
import type { MatchLifecycleStatus } from "./types";

export function normalizeProviderStatus(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().trim();
}

/**
 * Map provider status strings into product lifecycle states.
 * Does not invent live state when status is empty.
 */
export function resolveMatchLifecycle(input: {
  status?: string | null;
  kickoffUnix?: number | null;
  minute?: number | null;
  nowSec?: number;
}): MatchLifecycleStatus {
  const status = normalizeProviderStatus(input.status);
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const kickoff = input.kickoffUnix ?? null;

  if (!status && kickoff == null) return "unavailable";

  if (
    status.includes("abandon") ||
    status === "abd" ||
    status.includes("abandoned")
  ) {
    return "abandoned";
  }
  if (
    status.includes("cancel") ||
    status === "canc" ||
    status.includes("cancelled")
  ) {
    return "cancelled";
  }
  if (
    status.includes("suspend") ||
    status.includes("interrupted")
  ) {
    return "suspended";
  }
  if (isMatchPostponed(status) || status.includes("postpon")) {
    return "postponed";
  }

  if (
    ["complete", "finished", "ft", "ended", "full-time", "aet", "pen"].includes(
      status
    )
  ) {
    return "finished";
  }

  if (status === "ht" || status === "half-time" || status === "halftime") {
    return "half_time";
  }

  if (
    ["live", "inplay", "in_play", "playing", "1h", "2h", "et"].includes(status)
  ) {
    return "live";
  }

  if (["ns", "notstarted", "not_started", "scheduled", "fixture"].includes(status)) {
    if (kickoff != null && kickoff - now <= 2 * 60 * 60 && kickoff > now) {
      return "pre_match";
    }
    return "scheduled";
  }

  /*
   * THE LIVE-PATH FIX. This function received `minute` and never read it, so a league whose
   * provider reports an unmapped in-play status (FootyStats ships `incomplete` for matches in
   * progress) fell through to "unavailable" for the full ninety minutes while the same payload
   * carried the live minute and score — the page said "Status unavailable" until the snapshot
   * path caught up at full-time. A running match minute IS live evidence, not an invention: when
   * kickoff has passed and the payload reports a plausible in-play minute, the match is live.
   * The refusal to fake live stands for payloads with NO such evidence — status unclear and no
   * minute still reads "unavailable".
   */
  const minute = input.minute ?? null;
  const kickoffPassed = kickoff != null && kickoff <= now;
  const inPlayMinute = minute != null && minute >= 1 && minute <= 130;
  if (kickoffPassed && inPlayMinute) {
    return "live";
  }

  if (kickoff != null) {
    if (kickoff > now + 2 * 60 * 60) return "scheduled";
    if (kickoff > now) return "pre_match";
    // Kickoff passed, status unclear, and no in-play evidence — do not fake live.
    return "unavailable";
  }

  return status ? "unavailable" : "unavailable";
}

export function lifecycleLabel(status: MatchLifecycleStatus): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "pre_match":
      return "Pre-match";
    case "live":
      return "Live";
    case "half_time":
      return "Half-time";
    case "finished":
      return "Full-time";
    case "postponed":
      return "Postponed";
    case "cancelled":
      return "Cancelled";
    case "abandoned":
      return "Abandoned";
    case "suspended":
      return "Suspended";
    default:
      return "Status unavailable";
  }
}

export function shouldSoftRefresh(status: MatchLifecycleStatus): boolean {
  return status === "live" || status === "half_time";
}
