import type { AvailabilityDecision, AvailabilityReasonCode } from "./contracts";

export type AvailabilityInput = {
  affiliateEnabled: boolean;
  destinationConfigured: boolean;
  supportedCountries: readonly string[];
  visitorCountry?: string | null;
  featureOperatorsVisible: boolean;
  signingSecretPresent: boolean;
  verificationStatus: "verified" | "unverified";
  postbackConfigured?: boolean;
  marketSupported?: boolean | null;
};

export type AvailabilityResult = {
  decision: AvailabilityDecision;
  reasonCodes: AvailabilityReasonCode[];
  notes: string[];
};

/**
 * Deterministic availability — UNKNOWN is never treated as AVAILABLE.
 */
export function resolveOperatorAvailabilityDecision(
  input: AvailabilityInput
): AvailabilityResult {
  const codes: AvailabilityReasonCode[] = [];

  if (!input.featureOperatorsVisible) {
    return {
      decision: "DISABLED",
      reasonCodes: ["FEATURE_FLAG_DISABLED"],
      notes: ["FF_AFFILIATE_OPERATORS_VISIBLE / emergency disable"],
    };
  }

  if (!input.affiliateEnabled) {
    return {
      decision: "DISABLED",
      reasonCodes: ["OPERATOR_INACTIVE"],
      notes: ["affiliateEnabled=false"],
    };
  }

  if (!input.destinationConfigured) {
    return {
      decision: "MISCONFIGURED",
      reasonCodes: ["DESTINATION_MISSING", "AFFILIATE_URL_UNCONFIGURED"],
      notes: ["Affiliate URL contains TO-CONFIGURE or missing"],
    };
  }

  if (!input.signingSecretPresent) {
    codes.push("SIGNING_KEY_MISSING");
    return {
      decision: "MISCONFIGURED",
      reasonCodes: codes,
      notes: ["No AFFILIATE_REDIRECT_SECRET / ANALYTICS_SIGNING_SECRET"],
    };
  }

  if (input.marketSupported === false) {
    return {
      decision: "UNAVAILABLE",
      reasonCodes: ["MARKET_UNSUPPORTED"],
      notes: [],
    };
  }

  const countries = input.supportedCountries;
  const country = (input.visitorCountry ?? "").toUpperCase().trim();

  if (!countries.length) {
    // Empty list = not restricted in product rules, but geo is still UNKNOWN for legality claims
    codes.push("NO_COUNTRY_RESTRICTION");
    if (!country) {
      codes.push("UNKNOWN_GEO");
      return {
        decision: "UNKNOWN",
        reasonCodes: codes,
        notes: [
          "No country restriction configured; visitor geo unknown — not claimed AVAILABLE for geo",
        ],
      };
    }
    codes.push("COUNTRY_SUPPORTED");
    if (input.verificationStatus === "unverified") {
      return {
        decision: "REVIEW_REQUIRED",
        reasonCodes: [...codes, "STALE_AVAILABILITY_DATA"],
        notes: ["Operator unverified; availability not commercially asserted"],
      };
    }
    return {
      decision: "AVAILABLE",
      reasonCodes: codes,
      notes: ["Configured available (no country block list)"],
    };
  }

  if (!country) {
    return {
      decision: "UNKNOWN",
      reasonCodes: ["UNKNOWN_GEO"],
      notes: ["Visitor country unknown with non-empty support list"],
    };
  }

  if (!countries.map((c) => c.toUpperCase()).includes(country)) {
    return {
      decision: "UNAVAILABLE",
      reasonCodes: ["COUNTRY_BLOCKED"],
      notes: [`Country ${country} not in supportedCountries`],
    };
  }

  codes.push("COUNTRY_SUPPORTED");
  if (input.verificationStatus === "unverified") {
    return {
      decision: "REVIEW_REQUIRED",
      reasonCodes: [...codes, "STALE_AVAILABILITY_DATA"],
      notes: [],
    };
  }
  return {
    decision: "AVAILABLE",
    reasonCodes: codes,
    notes: [],
  };
}
