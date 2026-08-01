import { BRANDS } from "@/lib/brands";
import { isAffiliateConfigured } from "@/lib/affiliate";
import { listOperators } from "@/lib/operators/registry";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import type { OperatorRegistryRow } from "./contracts";
import { resolveOperatorAvailabilityDecision } from "./availability";

function signingSecretPresent(): boolean {
  const secret =
    process.env.AFFILIATE_REDIRECT_SECRET?.trim() ||
    process.env.ANALYTICS_SIGNING_SECRET?.trim() ||
    "";
  return secret.length >= 16 && !/change-me|dev-only|example/i.test(secret);
}

/** Normalize brand/operator registries into an audit-friendly view. */
export function buildOperatorRegistry(
  visitorCountry?: string | null
): OperatorRegistryRow[] {
  const flags = getFeatureFlags();
  const operators = listOperators();
  const brandBySlug = new Map(BRANDS.map((b) => [b.slug, b]));

  return operators.map((op) => {
    const brand = brandBySlug.get(op.slug);
    const destinationConfigured = brand
      ? isAffiliateConfigured(brand)
      : Boolean(op.website && !op.website.includes("TO-CONFIGURE"));

    const avail = resolveOperatorAvailabilityDecision({
      affiliateEnabled: op.affiliateEnabled,
      destinationConfigured,
      supportedCountries: op.supportedCountries,
      visitorCountry: visitorCountry ?? null,
      featureOperatorsVisible: flags.affiliateOperatorsVisible,
      signingSecretPresent: signingSecretPresent() || process.env.NODE_ENV !== "production",
      verificationStatus: op.verificationStatus,
    });

    const knownIssues: string[] = [];
    if (!destinationConfigured) knownIssues.push("destination_unconfigured");
    if (op.verificationStatus === "unverified") knownIssues.push("unverified");
    if (!op.supportedCountries.length) {
      knownIssues.push("no_country_restriction_configured");
    }
    if (!op.logo) knownIssues.push("logo_missing");

    return {
      operatorId: op.slug,
      displayName: op.name,
      partnerId: brand?.slug ?? null,
      supportedCountries: [...op.supportedCountries],
      blockedCountries: [],
      supportedLocales: [],
      supportedMarkets: [...op.supportedMarkets],
      destinationConfigured,
      affiliateEnabled: op.affiliateEnabled,
      verificationStatus: op.verificationStatus,
      availabilitySource: "lib/operators/registry + brands.affiliateUrl",
      lastVerifiedAt: null,
      signingReady: destinationConfigured && op.affiliateEnabled,
      disclaimerSource: "operator page / responsible gambling copy",
      logoPresent: Boolean(op.logo),
      fallbackBehavior: destinationConfigured
        ? "signed /go redirect"
        : "review / no outbound",
      knownIssues,
      availabilityDecision: avail.decision,
      reasonCodes: avail.reasonCodes,
    };
  });
}
