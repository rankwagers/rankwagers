import { BRANDS, buildAffiliateUrl, getBrand } from "@/lib/brands";

export type DeepLinkCapability =
  | "betslip"
  | "market"
  | "fixture"
  | "football_landing"
  | "homepage";

export type OperatorDeepLinkConfig = {
  operatorId: string;
  country?: string;
  capabilities: DeepLinkCapability[];
  templates: {
    betslip?: string;
    market?: string;
    fixture?: string;
    footballLanding?: string;
    homepage: string;
  };
  allowedHosts: string[];
  requiredParameters?: string[];
  enabled: boolean;
  verifiedAt?: string;
};

export type DeeplinkConfigIssue = {
  code:
    | "missing_homepage"
    | "invalid_host"
    | "capability_without_template"
    | "disabled_with_active_config"
    | "malformed_affiliate_url";
  message: string;
  operatorId: string;
};

function hostFromUrl(raw: string): string | null {
  try {
    const withProto = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function homepageTemplateFor(slug: string): {
  homepage: string;
  allowedHosts: string[];
} | null {
  const brand = getBrand(slug);
  if (!brand?.affiliateUrl) return null;
  const resolved = buildAffiliateUrl(brand, "probe");
  const host = hostFromUrl(resolved);
  if (!host) return null;
  return {
    homepage: brand.affiliateUrl,
    allowedHosts: [host],
  };
}

/** Manual capability overrides — never invent betslip/market/fixture without docs. */
export const MANUAL_DEEPLINK_OVERRIDES: OperatorDeepLinkConfig[] = [];

let cached: OperatorDeepLinkConfig[] | null = null;

export function listDeeplinkConfigs(): OperatorDeepLinkConfig[] {
  if (cached) return cached;
  const rows: OperatorDeepLinkConfig[] = [];
  for (const brand of BRANDS) {
    const home = homepageTemplateFor(brand.slug);
    if (!home) continue;
    rows.push({
      operatorId: brand.slug,
      capabilities: ["homepage"],
      templates: { homepage: home.homepage },
      allowedHosts: home.allowedHosts,
      enabled: true,
    });
  }
  const byKey = new Map(
    rows.map((r) => [`${r.operatorId}:${r.country ?? "*"}`, r])
  );
  for (const override of MANUAL_DEEPLINK_OVERRIDES) {
    byKey.set(`${override.operatorId}:${override.country ?? "*"}`, override);
  }
  cached = [...byKey.values()];
  return cached;
}

export function resetDeeplinkRegistryCache(): void {
  cached = null;
}

export function getDeeplinkConfig(
  operatorId: string,
  country?: string
): OperatorDeepLinkConfig | undefined {
  const configs = listDeeplinkConfigs().filter((c) => c.operatorId === operatorId);
  if (country) {
    const scoped = configs.find(
      (c) => c.country?.toUpperCase() === country.toUpperCase()
    );
    if (scoped) return scoped;
  }
  return configs.find((c) => !c.country);
}

export function validateDeeplinkConfigs(
  configs: readonly OperatorDeepLinkConfig[] = listDeeplinkConfigs()
): DeeplinkConfigIssue[] {
  const issues: DeeplinkConfigIssue[] = [];
  for (const config of configs) {
    if (!config.templates.homepage) {
      issues.push({
        code: "missing_homepage",
        message: `Missing homepage fallback for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
    if (!config.allowedHosts.length) {
      issues.push({
        code: "invalid_host",
        message: `No allowedHosts for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
    for (const host of config.allowedHosts) {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) && host !== "localhost") {
        issues.push({
          code: "invalid_host",
          message: `Invalid allowed host "${host}" for ${config.operatorId}`,
          operatorId: config.operatorId,
        });
      }
    }
    const caps = config.capabilities;
    if (caps.includes("betslip") && !config.templates.betslip) {
      issues.push({
        code: "capability_without_template",
        message: `betslip capability without template for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
    if (caps.includes("market") && !config.templates.market) {
      issues.push({
        code: "capability_without_template",
        message: `market capability without template for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
    if (caps.includes("fixture") && !config.templates.fixture) {
      issues.push({
        code: "capability_without_template",
        message: `fixture capability without template for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
    if (caps.includes("football_landing") && !config.templates.footballLanding) {
      issues.push({
        code: "capability_without_template",
        message: `football_landing capability without template for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
    if (!config.enabled && caps.length > 1) {
      issues.push({
        code: "disabled_with_active_config",
        message: `Disabled deeplink config still lists capabilities for ${config.operatorId}`,
        operatorId: config.operatorId,
      });
    }
  }
  return issues;
}

export function deeplinkCapabilityStats(
  configs: readonly OperatorDeepLinkConfig[] = listDeeplinkConfigs()
) {
  const counts: Record<DeepLinkCapability, number> = {
    betslip: 0,
    market: 0,
    fixture: 0,
    football_landing: 0,
    homepage: 0,
  };
  for (const config of configs) {
    if (!config.enabled) continue;
    for (const cap of config.capabilities) {
      counts[cap] += 1;
    }
  }
  return {
    operators: configs.length,
    capabilities: counts,
    issues: validateDeeplinkConfigs(configs).length,
  };
}
