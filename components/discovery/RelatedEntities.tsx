import { dedupeByHref, limitRepeatedLinks } from "@/lib/crawl-quality/links";
import type { DiscoveryPanelSection } from "@/lib/discovery";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { EntityGrid } from "./EntityGrid";

export function RelatedEntities({
  sections,
  layout = "list",
}: {
  sections: DiscoveryPanelSection[];
  layout?: "list" | "grid";
}) {
  if (!sections.length) return null;

  const seen = new Set<string>();
  const balanced = sections
    .map((section) => {
      const items = limitRepeatedLinks(
        dedupeByHref(section.items).filter((item) => {
          if (seen.has(item.href)) return false;
          seen.add(item.href);
          return true;
        }),
        8
      );
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  if (!balanced.length) return null;

  return (
    <div className="space-y-2" aria-label="Related entities">
      {balanced.map((section) =>
        layout === "grid" ? (
          <section key={section.id} className="mt-8" aria-labelledby={section.id}>
            <h2 id={section.id} className="font-display text-xl font-semibold text-foreground">
              {section.title}
            </h2>
            <EntityGrid items={section.items} labelledBy={section.id} />
          </section>
        ) : (
          <DiscoveryPanel
            key={section.id}
            title={section.title}
            items={section.items}
            showReason
          />
        )
      )}
    </div>
  );
}
