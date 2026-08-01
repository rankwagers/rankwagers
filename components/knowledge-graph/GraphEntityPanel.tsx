import type { Locale } from "@/lib/i18n";
import { limitRepeatedLinks } from "@/lib/crawl-quality/links";
import type { GraphEntityType } from "@/lib/knowledge-graph/entity";
import { buildEntityNavigation } from "@/lib/knowledge-graph/navigation";
import { GraphNavLink } from "./GraphNavLink";

/**
 * Graph-driven navigation + related entity links for any registered entity page.
 */
export function GraphEntityPanel({
  entityType,
  entitySlug,
  locale,
}: {
  entityType: GraphEntityType;
  entitySlug: string;
  locale: Locale;
}) {
  const navigation = buildEntityNavigation(entityType, entitySlug, locale);
  if (!navigation || navigation.sections.length === 0) return null;

  const seenHrefs = new Set<string>();

  return (
    <section
      className="border-b border-[var(--border-subtle)] py-8"
      aria-labelledby="knowledge-graph"
    >
      <h2 id="knowledge-graph" className="font-display text-xl font-semibold text-foreground">
        Connected research
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-[var(--ink-secondary)]">
        Automatic links from this {entityType} across the RankWagers knowledge graph.
        Factual relationships only — no tips or editorial rankings.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {navigation.sections.map((section) => {
          const intent =
            ["Competitions", "Markets", "Operators", "Teams", "Seasons"].includes(section.label)
              ? ("recommendation" as const)
              : section.label === "Fixtures" ||
                  section.label === "Evidence" ||
                  section.label === "Odds"
                ? ("related" as const)
                : ("graph" as const);
          const items = limitRepeatedLinks(
            section.items
              .filter((item) => {
                if (seenHrefs.has(item.href)) return false;
                seenHrefs.add(item.href);
                return true;
              })
              .map((item) => ({ ...item, href: item.href })),
            8
          );
          if (!items.length) return null;
          return (
            <div key={section.label}>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                {section.label}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {items.map((item) => (
                  <li key={`${section.label}-${item.id}`}>
                    <GraphNavLink
                      href={item.href}
                      fromType={entityType}
                      fromSlug={entitySlug}
                      toType={item.type}
                      toSlug={item.id.split(":").slice(1).join(":")}
                      locale={locale}
                      section={section.label}
                      intent={intent}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {item.title}
                    </GraphNavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
