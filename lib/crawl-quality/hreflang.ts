import { locales } from "@/lib/i18n";
import { hreflangLanguages, siteUrl } from "@/lib/seo";
import { buildPublicRouteInventory } from "./inventory";
import type { CrawlFinding, PublicRoute } from "./types";

export function auditHreflang(
  routes: readonly PublicRoute[] = buildPublicRouteInventory()
): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  let failures = 0;

  try {
    siteUrl();
  } catch {
    findings.push({
      id: "hreflang-site-url-fail",
      category: "hreflang",
      severity: "error",
      message: "SITE_URL unavailable; hreflang cannot be validated",
    });
    return findings;
  }

  const sample = routes.filter(
    (r) => r.kind === "entity" || r.kind === "hub" || r.kind === "home" || r.kind === "search"
  );

  for (const route of sample) {
    const path = route.path === "/" ? "/" : route.path;
    const languages = hreflangLanguages(path);
    const keys = Object.keys(languages);

    for (const locale of locales) {
      if (!languages[locale]) {
        failures += 1;
        findings.push({
          id: `hreflang-missing-${route.key}-${locale}`,
          category: "hreflang",
          severity: "error",
          entityType: route.entityType,
          entityId: route.entityId,
          message: `Missing hreflang alternate for locale ${locale} on ${route.path}`,
        });
      }
    }

    if (!languages["x-default"]) {
      failures += 1;
      findings.push({
        id: `hreflang-xdefault-missing-${route.key}`,
        category: "hreflang",
        severity: "error",
        message: `Missing x-default hreflang for ${route.path}`,
      });
    } else if (!languages["x-default"].includes("/en")) {
      failures += 1;
      findings.push({
        id: `hreflang-xdefault-locale-${route.key}`,
        category: "hreflang",
        severity: "error",
        message: `x-default must point at en for ${route.path}`,
      });
    }

    const uniqueLocales = new Set(keys.filter((k) => k !== "x-default"));
    if (uniqueLocales.size !== keys.filter((k) => k !== "x-default").length) {
      failures += 1;
      findings.push({
        id: `hreflang-dup-locale-${route.key}`,
        category: "hreflang",
        severity: "error",
        message: `Duplicate locale entries in hreflang for ${route.path}`,
      });
    }

    // Locale URLs must be distinct; x-default may intentionally equal `en`.
    const localeUrls = locales.map((locale) => languages[locale]).filter(Boolean);
    if (new Set(localeUrls).size !== localeUrls.length) {
      failures += 1;
      findings.push({
        id: `hreflang-dup-url-${route.key}`,
        category: "hreflang",
        severity: "error",
        message: `Duplicate hreflang locale URLs for ${route.path}`,
      });
    }
  }

  if (failures === 0) {
    findings.push({
      id: "hreflang-ok",
      category: "hreflang",
      severity: "pass",
      message: `Hreflang complete for ${sample.length} routes (${locales.length} locales + x-default)`,
    });
  }

  return findings;
}

export function hreflangCoverageScore(findings: readonly CrawlFinding[]): number {
  const relevant = findings.filter((f) => f.category === "hreflang");
  if (!relevant.length) return 100;
  const errors = relevant.filter((f) => f.severity === "error").length;
  if (errors === 0) return 100;
  const passes = relevant.filter((f) => f.severity === "pass").length;
  return Math.max(0, Math.round((passes / (passes + errors)) * 100));
}
