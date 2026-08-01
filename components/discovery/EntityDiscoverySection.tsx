import type { Locale } from "@/lib/i18n";
import {
  recommendForEntity,
  type DiscoveryEntityType,
} from "@/lib/discovery";
import { RelatedEntities } from "./RelatedEntities";
import { ContinueExploring } from "./ContinueExploring";
import { PopularResearch } from "./PopularResearch";
import { RecentlyViewed } from "./RecentlyViewed";
import { RecommendationImpressionTracker } from "./RecommendationImpressionTracker";

/**
 * Platform discovery block for entity pages.
 * Place below primary evidence content; never interrupts evidence sections.
 */
export function EntityDiscoverySection({
  entityType,
  entitySlug,
  locale,
  country,
}: {
  entityType: DiscoveryEntityType;
  entitySlug: string;
  locale: Locale;
  country?: string | null;
}) {
  const bundle = recommendForEntity(
    { entityType, slug: entitySlug },
    { locale, country, depth: 2, limitPerPanel: 6 }
  );

  const total =
    bundle.related.reduce((acc, section) => acc + section.items.length, 0) +
    bundle.continueExploring.length +
    bundle.popular.length;

  const sourceEntity = `${entityType}:${entitySlug}`;

  return (
    <section
      className="border-t border-[var(--border-subtle)] py-10"
      aria-labelledby="entity-discovery"
    >
      <RecommendationImpressionTracker
        sourceEntity={sourceEntity}
        count={total}
        locale={locale}
        country={country}
      />
      <h2 id="entity-discovery" className="font-display text-2xl font-semibold text-foreground">
        Discover connected research
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Recommendations from the knowledge graph and analytics — integrity-validated entities
        only. No editorial lists or AI suggestions.
      </p>

      <RelatedEntities sections={bundle.related} layout="list" />
      <ContinueExploring
        steps={bundle.continueExploring}
        sourceEntity={sourceEntity}
        locale={locale}
        country={country}
      />
      <PopularResearch
        items={bundle.popular}
        sourceEntity={sourceEntity}
        locale={locale}
        country={country}
      />
      <RecentlyViewed
        locale={locale}
        country={country}
        excludeKey={sourceEntity}
      />
    </section>
  );
}
