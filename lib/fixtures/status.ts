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

  if (kickoff != null) {
    if (kickoff > now + 2 * 60 * 60) return "scheduled";
    if (kickoff > now) return "pre_match";
    // Kickoff passed but status unclear — do not fake live.
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
