import { BRANDS } from "@/lib/brands";
import { postbackAdapterStats, listPostbackAdapters } from "@/lib/affiliate/postbacks";
import {
  bookmakerMappingStats,
  validateBookmakerMappings,
} from "./bookmaker-mapping";
import {
  deeplinkCapabilityStats,
  validateDeeplinkConfigs,
} from "./deeplink-registry";
import { marketMappingStats, validateMarketMappings } from "./market-mapping";

export type OperatorConfigValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Startup / test-time validation. Development should fail visibly on hard errors.
 * Production-safe mode treats mapping gaps as warnings (integrations stay disabled).
 */
export function validateOperatorIntegrationConfig(): OperatorConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const slugs = BRANDS.map((b) => b.slug);
  if (new Set(slugs).size !== slugs.length) {
    errors.push("Duplicate operator slugs in BRANDS");
  }

  for (const issue of validateBookmakerMappings()) {
    if (
      issue.code === "duplicate_provider_id" ||
      issue.code === "conflicting_canonical" ||
      issue.code === "alias_collision" ||
      issue.code === "country_conflict"
    ) {
      errors.push(issue.message);
    } else if (issue.code === "empty_mapping") {
      errors.push(issue.message);
    } else {
      warnings.push(issue.message);
    }
  }

  for (const issue of validateMarketMappings()) {
    if (issue.code === "enabled_without_keys" || issue.code === "wrong_line" || issue.code === "wrong_period") {
      errors.push(issue.message);
    } else {
      warnings.push(issue.message);
    }
  }

  for (const issue of validateDeeplinkConfigs()) {
    if (
      issue.code === "missing_homepage" ||
      issue.code === "invalid_host" ||
      issue.code === "capability_without_template"
    ) {
      errors.push(issue.message);
    } else {
      warnings.push(issue.message);
    }
  }

  for (const adapter of listPostbackAdapters()) {
    if (adapter.status === "configured" && adapter.authMethod === "none") {
      errors.push(
        `Postback adapter ${adapter.operatorId} configured without authentication`
      );
    }
  }

  // Unverified shells with empty IDs are expected — warn only via stats
  const bm = bookmakerMappingStats();
  if (bm.verified === 0 && bm.configured === 0) {
    warnings.push(
      "All bookmaker mappings are unverified shells — selection availability remains unknown"
    );
  }

  void marketMappingStats();
  void deeplinkCapabilityStats();
  void postbackAdapterStats();

  const isDev = process.env.NODE_ENV !== "production";
  return {
    ok: isDev ? errors.length === 0 : true,
    errors,
    warnings,
  };
}

export function assertOperatorConfigInDevelopment(): void {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.SKIP_OPERATOR_CONFIG_ASSERT === "1") return;
  const result = validateOperatorIntegrationConfig();
  if (!result.ok) {
    throw new Error(
      `Operator integration config invalid:\n${result.errors.join("\n")}`
    );
  }
}
