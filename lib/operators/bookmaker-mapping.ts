import { BRANDS } from "@/lib/brands";

export type MappingConfidence = "verified" | "configured" | "unverified";

export type OperatorBookmakerMapping = {
  operatorId: string;
  provider: string;
  providerBookmakerIds: string[];
  aliases: string[];
  countries?: string[];
  enabled: boolean;
  confidence: MappingConfidence;
  source: "provider" | "operator_docs" | "manual_config";
  updatedAt: string;
};

export type BookmakerMappingIssue = {
  code:
    | "duplicate_provider_id"
    | "conflicting_canonical"
    | "alias_collision"
    | "country_conflict"
    | "disabled_operator"
    | "empty_mapping"
    | "invalid_operator";
  message: string;
  operatorId?: string;
  providerBookmakerId?: string;
};

/** Manual overrides — add verified IDs here without changing runtime logic. */
export const MANUAL_BOOKMAKER_OVERRIDES: OperatorBookmakerMapping[] = [];

const SEED_UPDATED_AT = "2026-07-25T00:00:00.000Z";

function seedShell(slug: string): OperatorBookmakerMapping {
  return {
    operatorId: slug,
    provider: "api-football",
    providerBookmakerIds: [],
    aliases: [],
    enabled: true,
    confidence: "unverified",
    source: "manual_config",
    updatedAt: SEED_UPDATED_AT,
  };
}

function mergeMappings(
  base: OperatorBookmakerMapping[],
  overrides: readonly OperatorBookmakerMapping[]
): OperatorBookmakerMapping[] {
  const byId = new Map(base.map((m) => [m.operatorId, m]));
  for (const override of overrides) {
    byId.set(override.operatorId, override);
  }
  return [...byId.values()].sort((a, b) => a.operatorId.localeCompare(b.operatorId));
}

let cached: OperatorBookmakerMapping[] | null = null;

/** All 13 operators as unverified shells unless MANUAL_BOOKMAKER_OVERRIDES supplies IDs. */
export function listBookmakerMappings(): OperatorBookmakerMapping[] {
  if (cached) return cached;
  const shells = BRANDS.map((b) => seedShell(b.slug));
  cached = mergeMappings(shells, MANUAL_BOOKMAKER_OVERRIDES);
  return cached;
}

/** Test helper — clears module cache. */
export function resetBookmakerMappingCache(): void {
  cached = null;
}

export function getBookmakerMapping(
  operatorId: string
): OperatorBookmakerMapping | undefined {
  return listBookmakerMappings().find((m) => m.operatorId === operatorId);
}

/**
 * Positive availability requires verified, or configured with at least one explicit provider ID.
 * Unverified / empty ID lists never unlock full/partial priced availability.
 */
export function mappingAllowsPositiveAvailability(
  mapping: OperatorBookmakerMapping | undefined
): boolean {
  if (!mapping || !mapping.enabled) return false;
  if (mapping.confidence === "unverified") return false;
  if (!mapping.providerBookmakerIds.length) return false;
  if (mapping.confidence === "verified" || mapping.confidence === "configured") {
    return true;
  }
  return false;
}

export function resolveOperatorByProviderBookmakerId(
  providerBookmakerId: string | number,
  country?: string
): OperatorBookmakerMapping | undefined {
  const id = String(providerBookmakerId);
  const matches = listBookmakerMappings().filter(
    (m) =>
      m.enabled &&
      m.providerBookmakerIds.includes(id) &&
      mappingAllowsPositiveAvailability(m)
  );
  if (!matches.length) return undefined;
  if (matches.length > 1) return undefined; // ambiguous — leave unresolved
  const mapping = matches[0];
  if (mapping.countries?.length && country) {
    if (!mapping.countries.includes(country.toUpperCase())) return undefined;
  }
  return mapping;
}

/** Alias lookup — exact normalized alias only; never fuzzy. */
export function resolveOperatorByAlias(
  alias: string
): OperatorBookmakerMapping | undefined {
  const needle = alias.trim().toLowerCase();
  if (!needle) return undefined;
  const matches = listBookmakerMappings().filter((m) =>
    m.aliases.some((a) => a.trim().toLowerCase() === needle)
  );
  if (matches.length !== 1) return undefined;
  return matches[0];
}

export function validateBookmakerMappings(
  mappings: readonly OperatorBookmakerMapping[] = listBookmakerMappings()
): BookmakerMappingIssue[] {
  const issues: BookmakerMappingIssue[] = [];
  const knownSlugs = new Set(BRANDS.map((b) => b.slug));
  const idOwners = new Map<string, string>();
  const aliasOwners = new Map<string, string>();

  for (const mapping of mappings) {
    if (!knownSlugs.has(mapping.operatorId)) {
      issues.push({
        code: "invalid_operator",
        message: `Unknown operatorId ${mapping.operatorId}`,
        operatorId: mapping.operatorId,
      });
    }
    if (!mapping.enabled) {
      issues.push({
        code: "disabled_operator",
        message: `Operator mapping disabled: ${mapping.operatorId}`,
        operatorId: mapping.operatorId,
      });
    }
    if (
      (mapping.confidence === "verified" || mapping.confidence === "configured") &&
      mapping.providerBookmakerIds.length === 0
    ) {
      issues.push({
        code: "empty_mapping",
        message: `${mapping.confidence} mapping for ${mapping.operatorId} has empty providerBookmakerIds`,
        operatorId: mapping.operatorId,
      });
    }
    for (const providerId of mapping.providerBookmakerIds) {
      const prior = idOwners.get(providerId);
      if (prior && prior !== mapping.operatorId) {
        issues.push({
          code: "duplicate_provider_id",
          message: `Provider bookmaker ID ${providerId} claimed by ${prior} and ${mapping.operatorId}`,
          operatorId: mapping.operatorId,
          providerBookmakerId: providerId,
        });
        issues.push({
          code: "conflicting_canonical",
          message: `Conflicting canonical operators for provider ID ${providerId}`,
          providerBookmakerId: providerId,
        });
      } else {
        idOwners.set(providerId, mapping.operatorId);
      }
    }
    for (const alias of mapping.aliases) {
      const key = alias.trim().toLowerCase();
      if (!key) continue;
      const prior = aliasOwners.get(key);
      if (prior && prior !== mapping.operatorId) {
        issues.push({
          code: "alias_collision",
          message: `Alias "${alias}" claimed by ${prior} and ${mapping.operatorId}`,
          operatorId: mapping.operatorId,
        });
      } else {
        aliasOwners.set(key, mapping.operatorId);
      }
    }
  }

  // Country-scoped conflicts: same provider ID under overlapping country scopes
  const byProviderId = new Map<string, OperatorBookmakerMapping[]>();
  for (const mapping of mappings) {
    for (const id of mapping.providerBookmakerIds) {
      const list = byProviderId.get(id) ?? [];
      list.push(mapping);
      byProviderId.set(id, list);
    }
  }
  for (const [providerId, rows] of byProviderId) {
    if (rows.length < 2) continue;
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (a.operatorId === b.operatorId) continue;
        const aCountries = a.countries ?? [];
        const bCountries = b.countries ?? [];
        const overlap =
          !aCountries.length ||
          !bCountries.length ||
          aCountries.some((c) => bCountries.includes(c));
        if (overlap) {
          issues.push({
            code: "country_conflict",
            message: `Country-scoped conflict for provider ID ${providerId} between ${a.operatorId} and ${b.operatorId}`,
            providerBookmakerId: providerId,
          });
        }
      }
    }
  }

  return issues;
}

export function bookmakerMappingStats(
  mappings: readonly OperatorBookmakerMapping[] = listBookmakerMappings()
) {
  let verified = 0;
  let configured = 0;
  let unverified = 0;
  let withIds = 0;
  let totalIds = 0;
  for (const m of mappings) {
    if (m.confidence === "verified") verified += 1;
    else if (m.confidence === "configured") configured += 1;
    else unverified += 1;
    if (m.providerBookmakerIds.length) {
      withIds += 1;
      totalIds += m.providerBookmakerIds.length;
    }
  }
  return {
    total: mappings.length,
    verified,
    configured,
    unverified,
    withProviderIds: withIds,
    providerBookmakerIdCount: totalIds,
    issues: validateBookmakerMappings(mappings).length,
  };
}
