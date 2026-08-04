import { NextResponse } from "next/server";
import { getDailyMatchListsSafe, emptyLists } from "@/lib/footystats/client";
import { buildLiveFeed } from "@/lib/live-feed/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const result = await getDailyMatchListsSafe();
    const lists = "error" in result ? emptyLists() : result;

    /*
     * Archived rows carry the scores, statuses and clocks that were true when the archive was
     * captured, not now. Feeding them to the live builder would republish a stale minute and a
     * stale scoreline as a live observation — fabricating exactly the fields the archive cannot
     * know. When a same-day archive is standing in for a failed provider we therefore build the
     * feed from no rows at all, which yields the normal "no live data" state (incident 2026-08-01).
     *
     * The archived fixtures still power the lists, research and top picks; only the live-event
     * surface withholds, because only it makes a claim about the present.
     */
    /*
     * `last_good` withholds for the same reason `stale_daily_archive` does, and it matters more:
     * a replayed snapshot has minutes and scores frozen at the moment it was captured, so feeding
     * it to a present-tense surface would state a live scoreline that is no longer true.
     */
    const servingStale =
      lists.provenance?.source === "stale_daily_archive" ||
      lists.provenance?.source === "last_good";
    const liveRows = servingStale
      ? []
      : [...lists.fh, ...lists.over25, ...lists.over15, ...lists.sh].filter(
          (r, i, arr) => arr.findIndex((x) => x.matchId === r.matchId) === i
        );

    const feed = await buildLiveFeed(
      liveRows,
      servingStale ? { fh: [], over25: [] } : { fh: lists.fh, over25: lists.over25 }
    );
    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Live feed error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
