import type { TimelineEvent } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";

export function EvidenceTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return null;
  return (
    <section className={evidenceUiTokens.card} aria-labelledby="evidence-timeline">
      <h2 id="evidence-timeline" className="text-[14px] font-semibold">
        Evidence timeline
      </h2>
      <p className={`mt-1 ${evidenceUiTokens.note}`}>
        Qualified fixtures, coverage, and provider refresh — no odds movement.
      </p>
      <ol className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="pl-3" style={{ borderLeft: "2px solid var(--line)" }}>
            <p className="text-[13px] font-medium">{event.title}</p>
            {event.detail ? <p className={evidenceUiTokens.note}>{event.detail}</p> : null}
            <p className="rw3-meta mt-1">{event.atLabel}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
