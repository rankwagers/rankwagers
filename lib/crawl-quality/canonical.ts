import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { buildPublicRouteInventory } from "./inventory";
import type { CrawlFinding, PublicRoute } from "./types";

function metaCanonical(meta: ReturnType<typeof pageMetadata>): string | undefined {
  const alt = meta.alternates;
  if (!alt || typeof alt !== "object") return undefined;
  const canonical = (alt as { canonical?: string | URL }).canonical;
  if (!canonical) return undefined;
  return String(canonical);
}

export function absoluteCanonical(locale: Locale, path: string): string {
  const base = siteUrl();
  const suffix = path === "/" ? "" : path;
  return `${base}/${locale}${suffix}`;
}

export function auditCanonicals(
  routes: readonly PublicRoute[] = buildPublicRouteInventory()
): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  const seen = new Map<string, string>();
  let broken = 0;
  let duplicates = 0;

  try {
    siteUrl();
    findings.push({
      id: "canonical-site-url",
      category: "canonical",
      severity: "pass",
      message: "SITE_URL resolver available for canonical generation",
    });
  } catch {
    findings.push({
      id: "canonical-site-url-fail",
      category: "canonical",
      severity: "error",
      message: "SITE_URL resolver threw; canonicals cannot be validated",
    });
    return findings;
  }

  for (const route of routes) {
    for (const locale of locales) {
      const expected = absoluteCanonical(locale, route.path);
      let meta: ReturnType<typeof pageMetadata>;
      try {
        meta = pageMetadata({
          locale,
          path: route.path === "/" ? "/" : route.path,
          title: route.title,
          description: `${route.title} research page`,
          index: route.indexable,
        });
      } catch {
        broken += 1;
        findings.push({
          id: `canonical-throw-${route.key}-${locale}`,
          category: "canonical",
          severity: "error",
          entityType: route.entityType,
          entityId: route.entityId,
          message: `pageMetadata threw for ${route.path} (${locale})`,
        });
        continue;
      }

      const canonical = metaCanonical(meta);
      if (!canonical) {
        broken += 1;
        findings.push({
          id: `canonical-missing-${route.key}-${locale}`,
          category: "canonical",
          severity: "error",
          entityType: route.entityType,
          entityId: route.entityId,
          message: `Missing canonical for ${route.path} (${locale})`,
        });
        continue;
      }

      if (canonical !== expected) {
        broken += 1;
        findings.push({
          id: `canonical-mismatch-${route.key}-${locale}`,
          category: "canonical",
          severity: "error",
          entityType: route.entityType,
          entityId: route.entityId,
          message: `Canonical does not point to self: got ${canonical}, expected ${expected}`,
        });
      }

      const prior = seen.get(canonical);
      if (prior && prior !== `${route.key}:${locale}`) {
        // Same route across locales must have distinct canonicals; duplicates across routes are errors
        const priorKey = prior.split(":")[0];
        if (priorKey !== route.key) {
          duplicates += 1;
          findings.push({
            id: `canonical-dup-${canonical}`,
            category: "canonical",
            severity: "error",
            message: `Duplicate canonical target ${canonical} (${prior} vs ${route.key}:${locale})`,
          });
        }
      } else {
        seen.set(canonical, `${route.key}:${locale}`);
      }
    }
  }

  if (broken === 0) {
    findings.push({
      id: "canonical-self-ok",
      category: "canonical",
      severity: "pass",
      message: "All inventoried routes expose self-canonical URLs across locales",
    });
  }

  if (duplicates === 0) {
    findings.push({
      id: "canonical-unique-ok",
      category: "canonical",
      severity: "pass",
      message: "No duplicate canonical targets across distinct routes",
    });
  }

  return findings;
}

export function countBrokenCanonicals(findings: readonly CrawlFinding[]): number {
  return findings.filter(
    (f) => f.category === "canonical" && f.severity === "error"
  ).length;
}
