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
        <h2 id="popular-research" className="font-display text-xl font-semibold text-foreground">
          Popular Research
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ranked from analytics views and clicks — not editorial lists.
        </p>
        <EntityCarousel items={items} labelledBy="popular-research" />
      </section>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="popular-research">
      <h2 id="popular-research" className="font-display text-xl font-semibold text-foreground">
        Popular Research
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ranked from analytics views and clicks — not editorial lists.
      </p>
      <ul className="mt-3 divide-y divide-border border-y border-border">
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
              className="flex items-baseline justify-between gap-3 py-2.5 text-sm text-foreground hover:text-brand"
            >
              <span>{item.title}</span>
              <span className="shrink-0 text-metadata uppercase tracking-label text-muted-foreground">
                {item.entityType}
              </span>
            </DiscoveryTrackLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
