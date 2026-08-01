/**
 * Compatibility re-export — prefer components/discovery/*.
 */
export { DiscoveryPanel } from "@/components/discovery/DiscoveryPanel";

import type { DiscoveryPanelSection } from "@/lib/search/discovery";
import { DiscoveryPanel } from "@/components/discovery/DiscoveryPanel";
import type { RecommendationItem } from "@/lib/discovery";

export function DiscoveryPanelList({
  sections,
}: {
  sections: DiscoveryPanelSection[];
}) {
  if (!sections.length) return null;
  return (
    <div className="mt-10 space-y-2">
      {sections.map((section) => (
        <DiscoveryPanel
          key={section.id}
          title={section.title}
          items={section.items.map(
            (item, index): RecommendationItem => ({
              entityType: item.entityType as RecommendationItem["entityType"],
              slug: item.slug,
              title: item.title,
              href: item.href,
              reason: "related",
              position: index,
            })
          )}
        />
      ))}
    </div>
  );
}
