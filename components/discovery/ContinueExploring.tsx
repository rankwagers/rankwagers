import type { ContinueExploringStep } from "@/lib/discovery";
import { DiscoveryTrackLink } from "./DiscoveryTrackLink";

export function ContinueExploring({
  steps,
  sourceEntity,
  locale,
  country,
}: {
  steps: ContinueExploringStep[];
  sourceEntity: string;
  locale: string;
  country?: string | null;
}) {
  if (!steps.length) return null;
  return (
    <nav className="mt-8" aria-labelledby="continue-exploring">
      <h2 id="continue-exploring" className="rw3-title">
        Continue Exploring
      </h2>
      <p className="mt-2 max-w-2xl text-[13px]" style={{ color: "var(--muted)" }}>
        A graph-derived path through related research entities — no editorial picks.
      </p>
      <ol className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        {steps.map((step, index) => (
          <li key={`${step.entityType}-${step.slug}`} className="flex items-center gap-2">
            {index > 0 ? (
              <span style={{ color: "var(--muted)" }} aria-hidden>
                →
              </span>
            ) : null}
            <DiscoveryTrackLink
              href={step.href}
              eventName="continue_exploring_click"
              sourceEntity={sourceEntity}
              targetEntity={`${step.entityType}:${step.slug}`}
              relationship={String(step.relationship ?? step.reason)}
              position={step.position}
              locale={locale}
              country={country}
              className="rw3-ghost"
            >
              {step.title}
            </DiscoveryTrackLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
