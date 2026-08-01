import { isRenderableLiveSnapshot } from "@/lib/live/snapshot";
import type { LiveMatchSnapshot } from "@/types/live";
import { LiveAnnouncer } from "./LiveAnnouncer";
import { LiveConnectionNotice } from "./LiveConnectionNotice";
import { LiveMatchHeader } from "./LiveMatchHeader";
import { LiveMatchProvider } from "./LiveMatchProvider";
import { LiveMomentumGraph } from "./LiveMomentumGraph";
import { LiveSectionViewTracker } from "./LiveSectionViewTracker";
import { LiveStatisticsTable } from "./LiveStatisticsTable";
import { LiveTimelineCard } from "./LiveTimelineCard";

/**
 * Sprint 22 — the Live Match section shell.
 *
 * A **server component**. All headings, static copy, section landmarks and the first paint of
 * every panel are produced on the server; the client island only takes over the values that
 * change. That is the SEO contract for this sprint: a crawler and a JavaScript-disabled
 * browser both receive the full live state as HTML.
 *
 * Visibility is decided by exactly one predicate — `isRenderableLiveSnapshot` — so the section
 * appears for live fixtures and is entirely absent (not hidden with CSS) for everything else.
 * Returning `null` also means no live JavaScript is shipped for a non-live fixture.
 */

export function LiveMatchSection({
  snapshot,
  locale,
  className = "",
}: {
  snapshot: LiveMatchSnapshot | null | undefined;
  locale: string;
  className?: string;
}) {
  if (!isRenderableLiveSnapshot(snapshot)) return null;

  const headingId = `live-match-heading-${snapshot.matchId}`;
  const timelineHeadingId = `live-timeline-heading-${snapshot.matchId}`;
  const momentumHeadingId = `live-momentum-heading-${snapshot.matchId}`;
  const statisticsHeadingId = `live-statistics-heading-${snapshot.matchId}`;

  return (
    <section
      aria-labelledby={headingId}
      data-live-match-section=""
      data-testid="live-match-section"
      className={`space-y-4 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-display text-xl font-semibold text-foreground">
          Live match
        </h2>
        <p className="text-xs text-muted-foreground">
          In-play observations from the match feed. Momentum is derived by RankWagers and
          labelled as such.
        </p>
      </div>

      <LiveMatchProvider
        matchId={snapshot.matchId}
        locale={locale}
        initialSnapshot={snapshot}
      >
        <LiveSectionViewTracker
          matchId={snapshot.matchId}
          locale={locale}
          snapshot={snapshot}
        />
        <LiveAnnouncer />

        <LiveMatchHeader
          homeTeam={snapshot.homeTeam}
          awayTeam={snapshot.awayTeam}
          initialStatus={snapshot.status}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 lg:col-span-2">
            <h3
              id={timelineHeadingId}
              className="text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]"
            >
              Timeline
            </h3>
            <LiveTimelineCard
              initialTimeline={snapshot.timeline}
              initialPhase={snapshot.status.phase}
              homeTeam={snapshot.homeTeam}
              awayTeam={snapshot.awayTeam}
              matchId={snapshot.matchId}
              locale={locale}
              headingId={timelineHeadingId}
            />
          </div>

          <div className="space-y-3">
            <h3
              id={momentumHeadingId}
              className="text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]"
            >
              Momentum
            </h3>
            <LiveMomentumGraph
              initialMomentum={snapshot.momentum}
              initialPhase={snapshot.status.phase}
              homeTeam={snapshot.homeTeam}
              awayTeam={snapshot.awayTeam}
              matchId={snapshot.matchId}
              locale={locale}
            />
          </div>

          <div className="space-y-3">
            <h3
              id={statisticsHeadingId}
              className="text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]"
            >
              In-play statistics
            </h3>
            <LiveStatisticsTable
              initialStatistics={snapshot.statistics}
              initialPhase={snapshot.status.phase}
              homeTeam={snapshot.homeTeam}
              awayTeam={snapshot.awayTeam}
              matchId={snapshot.matchId}
              locale={locale}
              captionId={statisticsHeadingId}
            />
          </div>
        </div>

        <LiveConnectionNotice />
      </LiveMatchProvider>
    </section>
  );
}
