import type { RecommendationItem } from "@/lib/discovery";
import { DiscoveryTrackLink } from "./DiscoveryTrackLink";
import { EntityCarousel } from "./EntityCarousel";

export function PopularResearch({
  items,
  sourceEntity,
  locale,
  country,
  layout = "list",
}: {
  items: RecommendationItem[];
  sourceEntity?: string;
  locale: string;
  country?: string | null;
  layout?: "list" | "carousel";
}) {
  if (!items.length) return null;

  if (layout === "carousel") {
    return (
      <section className="mt-8" aria-labelledby="popular-research">
        <h2 id="popular-research" className="rw3-title">
          Popular Research
        </h2>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
          Ranked from analytics views and clicks — not editorial lists.
        </p>
        <EntityCarousel items={items} labelledBy="popular-research" />
      </section>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="popular-research">
      <h2 id="popular-research" className="rw3-title">
        Popular Research
      </h2>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
        Ranked from analytics views and clicks — not editorial lists.
      </p>
      <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {items.map((item) => (
          <li key={`${item.entityType}-${item.slug}`}>
            <DiscoveryTrackLink
              href={item.href}
              eventName="popular_click"
              sourceEntity={sourceEntity ?? "popular"}
              targetEntity={`${item.entityType}:${item.slug}`}
              relationship="analytics_popularity"
              position={item.position}
              locale={locale}
              country={country}
              className="rw3-hoverable flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
            >
              <span>{item.title}</span>
              <span className="rw3-label shrink-0">
                {item.entityType}
              </span>
            </DiscoveryTrackLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
