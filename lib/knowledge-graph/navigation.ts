import type { Locale } from "@/lib/i18n";
import { entityId, type GraphEntity, type GraphEntityType } from "./entity";
import { getKnowledgeGraph } from "./graph";

export type GraphNavItem = {
  id: string;
  type: GraphEntityType;
  title: string;
  href: string;
  kind: string;
};

export type GraphNavigation = {
  entity: GraphEntity;
  canonicalPath: string;
  sections: Array<{
    label: string;
    items: GraphNavItem[];
  }>;
  breadcrumbs: GraphNavItem[];
};

function withLocale(locale: Locale, path: string): string {
  if (path.startsWith("/?")) return `/${locale}${path.slice(1)}`;
  if (path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  if (path.startsWith("?")) return `/${locale}${path}`;
  if (path.startsWith("#")) return `/${locale}${path}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

const SECTION_ORDER: Array<{ label: string; types: GraphEntityType[] }> = [
  { label: "Fixtures", types: ["fixture"] },
  { label: "Markets", types: ["market"] },
  { label: "Operators", types: ["operator"] },
  { label: "Competitions", types: ["competition"] },
  { label: "Teams", types: ["team"] },
  { label: "Evidence", types: ["evidence"] },
  { label: "Odds", types: ["odds"] },
  { label: "Countries", types: ["country"] },
  { label: "Seasons", types: ["season"] },
];

export function localizeEntityHref(locale: Locale, entity: GraphEntity): string {
  return withLocale(locale, entity.path);
}

export function buildEntityNavigation(
  type: GraphEntityType,
  slug: string,
  locale: Locale
): GraphNavigation | null {
  const graph = getKnowledgeGraph();
  const id = entityId(type, slug);
  const entity = graph.getEntity(id);
  if (!entity) return null;

  const neighbors = graph.neighbors(id);
  const sections = SECTION_ORDER.map((section) => {
    const items = neighbors
      .filter((row) => section.types.includes(row.entity.type))
      .slice(0, 8)
      .map((row) => ({
        id: row.entity.id,
        type: row.entity.type,
        title: row.entity.title,
        href: localizeEntityHref(locale, row.entity),
        kind: row.kind,
      }));
    // Deduplicate by id
    const unique = new Map(items.map((item) => [item.id, item]));
    return { label: section.label, items: [...unique.values()] };
  }).filter((section) => section.items.length > 0);

  const breadcrumbs: GraphNavItem[] = [
    {
      id: "home",
      type: "fixture",
      title: "Home",
      href: `/${locale}`,
      kind: "root",
    },
  ];

  if (
    type === "competition" ||
    type === "market" ||
    type === "operator" ||
    type === "team" ||
    type === "season" ||
    type === "country"
  ) {
    const indexMeta =
      type === "competition"
        ? { title: "Competitions", path: "competitions" }
        : type === "market"
          ? { title: "Markets", path: "markets" }
          : type === "operator"
            ? { title: "Operators", path: "operators" }
            : type === "team"
              ? { title: "Teams", path: "teams" }
              : type === "country"
                ? { title: "Countries", path: "countries" }
                : { title: "Seasons", path: "seasons" };
    breadcrumbs.push({
      id: `${type}-index`,
      type,
      title: indexMeta.title,
      href: `/${locale}/${indexMeta.path}`,
      kind: "index",
    });
  }

  breadcrumbs.push({
    id: entity.id,
    type: entity.type,
    title: entity.title,
    href: localizeEntityHref(locale, entity),
    kind: "self",
  });

  return {
    entity,
    canonicalPath: localizeEntityHref(locale, entity),
    sections,
    breadcrumbs,
  };
}
