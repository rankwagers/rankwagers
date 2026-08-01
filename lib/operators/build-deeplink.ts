import { buildAffiliateUrl, getBrand } from "@/lib/brands";
import {
  getDeeplinkConfig,
  type DeepLinkCapability,
} from "./deeplink-registry";

export type BuiltOperatorLink = {
  operatorId: string;
  /** Absolute destination — server-side only; never send to client. */
  destinationUrl: string;
  deeplinkType: DeepLinkCapability | "unavailable";
  fallbackReason?: string;
  expiresAt?: string;
  allowedHost: string;
};

const PRIORITY: DeepLinkCapability[] = [
  "betslip",
  "market",
  "fixture",
  "football_landing",
  "homepage",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function fillTemplate(
  template: string,
  params: Record<string, string>
): string {
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replaceAll(`{${key}}`, encodeURIComponent(value));
  }
  return out;
}

/**
 * Build an affiliate destination server-side.
 * Never accepts a client-supplied destination URL.
 */
export function buildOperatorDeeplink(input: {
  operatorId: string;
  country?: string;
  subid: string;
  preferred?: DeepLinkCapability;
  /** Identifiers for higher-capability templates — unused until capabilities exist. */
  params?: Record<string, string>;
}): BuiltOperatorLink {
  const brand = getBrand(input.operatorId);
  const config = getDeeplinkConfig(input.operatorId, input.country);

  if (!brand || !config || !config.enabled) {
    return {
      operatorId: input.operatorId,
      destinationUrl: "",
      deeplinkType: "unavailable",
      fallbackReason: "operator_or_config_unavailable",
      allowedHost: "",
    };
  }

  const startIndex = input.preferred
    ? Math.max(0, PRIORITY.indexOf(input.preferred))
    : 0;

  let fallbackReason: string | undefined;

  for (let i = startIndex; i < PRIORITY.length; i++) {
    const capability = PRIORITY[i];
    if (!config.capabilities.includes(capability)) {
      if (i === startIndex && input.preferred) {
        fallbackReason = `capability_unsupported:${input.preferred}`;
      }
      continue;
    }

    let template: string | undefined;
    switch (capability) {
      case "betslip":
        template = config.templates.betslip;
        break;
      case "market":
        template = config.templates.market;
        break;
      case "fixture":
        template = config.templates.fixture;
        break;
      case "football_landing":
        template = config.templates.footballLanding;
        break;
      case "homepage":
        template = config.templates.homepage;
        break;
    }

    if (!template) {
      fallbackReason = `template_missing:${capability}`;
      continue;
    }

    // Betslip/market/fixture templates must not invent syntax — only homepage uses brand helper today.
    const destinationUrl =
      capability === "homepage"
        ? buildAffiliateUrl(brand, input.subid)
        : fillTemplate(template, {
            subid: input.subid,
            ...(input.params ?? {}),
          });

    const host = hostOf(destinationUrl);
    if (!host || !config.allowedHosts.map((h) => h.toLowerCase()).includes(host)) {
      fallbackReason = `host_rejected:${host ?? "invalid"}`;
      continue;
    }

    // Protocol / traversal guards
    if (
      !/^https?:\/\//i.test(destinationUrl) ||
      destinationUrl.includes("\\") ||
      destinationUrl.includes("..")
    ) {
      fallbackReason = "unsafe_destination";
      continue;
    }

    return {
      operatorId: input.operatorId,
      destinationUrl,
      deeplinkType: capability,
      fallbackReason:
        capability !== (input.preferred ?? "homepage")
          ? fallbackReason ?? `fell_back_to:${capability}`
          : fallbackReason,
      allowedHost: host,
    };
  }

  return {
    operatorId: input.operatorId,
    destinationUrl: "",
    deeplinkType: "unavailable",
    fallbackReason: fallbackReason ?? "no_valid_capability",
    allowedHost: "",
  };
}
