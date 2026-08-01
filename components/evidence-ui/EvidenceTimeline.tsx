import type { TimelineEvent } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";

export function EvidenceTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return null;
  return (
    <section className={evidenceUiTokens.card} aria-labelledby="evidence-timeline">
      <h2 id="evidence-timeline" className="font-display text-lg font-semibold text-foreground">
        Evidence timeline
      </h2>
      <p className={`mt-1 ${evidenceUiTokens.note}`}>
        Qualified fixtures, coverage, and provider refresh — no odds movement.
      </p>
      <ol className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="border-l-2 border-border pl-3">
            <p className="text-sm font-medium text-foreground">{event.title}</p>
            {event.detail ? <p className={evidenceUiTokens.note}>{event.detail}</p> : null}
            <p className="mt-1 text-metadata text-muted-foreground">{event.atLabel}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
