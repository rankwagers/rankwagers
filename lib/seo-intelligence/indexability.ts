import type {
  IndexabilityDecision,
  IndexabilityReasonCode,
  SeoPageType,
} from "./contracts";
import { contractFor } from "./page-types";

export type IndexabilityInput = {
  pageType: SeoPageType;
  path: string;
  /** From inventory / page data when known */
  hasPrimaryEntity?: boolean;
  hasTitle?: boolean;
  hasDescription?: boolean;
  thinSignals?: number;
  settledCount?: number;
  totalArchiveRows?: number;
  contentBlocks?: number;
  relatedCount?: number;
  doorwayRisk?: boolean;
  fixtureIndexable?: boolean | null;
  lifecycle?: string | null;
  compareAllowlisted?: boolean;
  stagingNoIndex?: boolean;
};

export type IndexabilityResult = {
  decision: IndexabilityDecision;
  reasonCodes: IndexabilityReasonCode[];
  notes: string[];
};

/**
 * Deterministic indexability — hard rules win over quality scores.
 * Does not invent page facts; missing signals → REVIEW_REQUIRED or conservative NOINDEX.
 */
export function resolveIndexability(input: IndexabilityInput): IndexabilityResult {
  const codes: IndexabilityReasonCode[] = [];
  const notes: string[] = [];

  if (input.stagingNoIndex) {
    return {
      decision: "NOINDEX",
      reasonCodes: ["STAGING_OVERRIDE"],
      notes: ["Staging or STAGING_NOINDEX forces noindex"],
    };
  }

  switch (input.pageType) {
    case "admin":
      return { decision: "EXCLUDED", reasonCodes: ["ADMIN_ROUTE"], notes: [] };
    case "developer":
      return { decision: "EXCLUDED", reasonCodes: ["DEVELOPER_ROUTE"], notes: [] };
    case "search":
      return {
        decision: "NOINDEX",
        reasonCodes: ["SEARCH_RESULT_PAGE"],
        notes: ["Search SERPs stay noindex"],
      };
    case "acca_studio":
    case "acca_builder":
      return {
        decision: "NOINDEX",
        reasonCodes: ["PRIVATE_WORKSPACE"],
        notes: ["Acca surfaces remain noindex"],
      };
    case "combo_redirect":
      return {
        decision: "REDIRECT",
        reasonCodes: ["CANONICAL_REDIRECT"],
        notes: ["Redirects to Acca Builder; exclude from sitemap"],
      };
    case "utility":
      return {
        decision: "NOINDEX",
        reasonCodes: ["UTILITY_NOINDEX"],
        notes: [],
      };
    case "error":
      return {
        decision: "ERROR",
        reasonCodes: ["INVALID_FIXTURE"],
        notes: ["Error surfaces rely on HTTP status"],
      };
    default:
      break;
  }

  if (input.hasPrimaryEntity === false) {
    codes.push("MISSING_PRIMARY_ENTITY");
    return { decision: "NOINDEX", reasonCodes: codes, notes };
  }

  if (input.hasTitle === false || input.hasDescription === false) {
    codes.push("MISSING_REQUIRED_METADATA");
    return { decision: "NOINDEX", reasonCodes: codes, notes };
  }

  if (input.doorwayRisk) {
    codes.push("AFFILIATE_DOORWAY_RISK");
    return { decision: "NOINDEX", reasonCodes: codes, notes };
  }

  if (input.pageType === "fixture") {
    if (input.lifecycle === "cancelled") {
      return {
        decision: "NOINDEX",
        reasonCodes: ["CANCELLED_FIXTURE"],
        notes: [],
      };
    }
    if (input.lifecycle === "postponed" && input.fixtureIndexable === false) {
      return {
        decision: "NOINDEX",
        reasonCodes: ["POSTPONED_WITHOUT_VALUE"],
        notes: [],
      };
    }
    if (input.fixtureIndexable === false) {
      return {
        decision: "NOINDEX",
        reasonCodes: ["NO_PUBLISHED_PREDICTION", "THIN_CONTENT"],
        notes: ["Match page model reported non-indexable"],
      };
    }
    if (input.fixtureIndexable === true) {
      return {
        decision: "INDEX",
        reasonCodes: ["VALID_PUBLISHED_MATCH"],
        notes: [],
      };
    }
    return {
      decision: "REVIEW_REQUIRED",
      reasonCodes: ["NO_PUBLISHED_PREDICTION"],
      notes: ["Fixture indexability not loaded in this audit batch"],
    };
  }

  if (input.pageType === "archive_hub") {
    const settled = input.settledCount ?? 0;
    if (settled >= 3) {
      return {
        decision: "INDEX",
        reasonCodes: ["VALID_SETTLED_ARCHIVE"],
        notes: [`settled=${settled}`],
      };
    }
    return {
      decision: "NOINDEX",
      reasonCodes: ["LOW_SAMPLE_CONTENT"],
      notes: ["Archive hub requires settledPredictions >= 3"],
    };
  }

  if (input.pageType === "archive_day") {
    if (input.settledCount == null && input.totalArchiveRows == null) {
      return {
        decision: "REVIEW_REQUIRED",
        reasonCodes: ["VALID_SETTLED_ARCHIVE", "LOW_SAMPLE_CONTENT"],
        notes: ["Archive day settlement counts not loaded in this batch"],
      };
    }
    const settled = input.settledCount ?? 0;
    const total = input.totalArchiveRows ?? 0;
    if (settled >= 1 || total >= 3) {
      return {
        decision: "INDEX",
        reasonCodes: ["VALID_SETTLED_ARCHIVE"],
        notes: [],
      };
    }
    return {
      decision: "NOINDEX",
      reasonCodes: ["EMPTY_COLLECTION", "THIN_CONTENT"],
      notes: ["Empty archive date"],
    };
  }

  if (input.pageType === "compare" && input.compareAllowlisted === false) {
    return {
      decision: "NOINDEX",
      reasonCodes: ["THIN_CONTENT"],
      notes: ["Compare slug not on indexable allowlist"],
    };
  }

  const thin = input.thinSignals ?? 0;
  if (thin >= 2) {
    codes.push("THIN_CONTENT");
    return {
      decision: "REVIEW_REQUIRED",
      reasonCodes: codes,
      notes: ["Thin signals detected — prefer noindex until remediated"],
    };
  }

  if (
    (input.contentBlocks ?? 1) < 1 &&
    (input.relatedCount ?? 0) < 1 &&
    contractFor(input.pageType)?.defaultIndexability === "CONDITIONAL"
  ) {
    return {
      decision: "NOINDEX",
      reasonCodes: ["THIN_CONTENT", "LOW_SAMPLE_CONTENT"],
      notes: [],
    };
  }

  const contract = contractFor(input.pageType);
  if (contract?.defaultIndexability === "INDEX") {
    return {
      decision: "INDEX",
      reasonCodes: ["VALID_EVERGREEN_PAGE"],
      notes: [],
    };
  }

  if (contract?.defaultIndexability === "NOINDEX") {
    return {
      decision: "NOINDEX",
      reasonCodes: ["UTILITY_NOINDEX"],
      notes: [],
    };
  }

  return {
    decision: "INDEX",
    reasonCodes: ["VALID_EVERGREEN_PAGE"],
    notes: ["Default registry entity with no thin/doorway signals"],
  };
}

export function isSitemapEligible(
  decision: IndexabilityDecision,
  pageType: SeoPageType
): boolean {
  if (decision !== "INDEX") return false;
  const contract = contractFor(pageType);
  return contract?.sitemapEligible === true;
}
