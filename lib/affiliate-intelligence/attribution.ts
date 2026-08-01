/**
 * Attribution governance — allowed fields and validation.
 * Client must not override protected fields.
 */

export const PROTECTED_ATTRIBUTION_FIELDS = [
  "operator",
  "placement",
  "campaign",
  "partner",
  "requestId",
  "signedRedirectId",
] as const;

export const ALLOWED_ATTRIBUTION_FIELDS = [
  ...PROTECTED_ATTRIBUTION_FIELDS,
  "pageType",
  "locale",
  "country",
  "fixture",
  "competition",
  "market",
  "builderMode",
  "accaLegCount",
  "sourceChannel",
  "sessionCorrelation",
  "timestamp",
] as const;

export type AttributionValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  normalized: Record<string, string | number | null>;
};

const PLACEMENT_RE = /^[a-z][a-z0-9_]{1,64}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,64}$/;

/** Validate and normalize attribution bags (no PII, no secrets, bounded). */
export function validateAttribution(
  raw: Record<string, unknown> | null | undefined
): AttributionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized: Record<string, string | number | null> = {};

  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["missing_attribution"], warnings, normalized };
  }

  for (const [key, value] of Object.entries(raw)) {
    if (!(ALLOWED_ATTRIBUTION_FIELDS as readonly string[]).includes(key)) {
      warnings.push(`dropped_unknown_field:${key}`);
      continue;
    }
    if (value == null) {
      normalized[key] = null;
      continue;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
        errors.push(`invalid_number:${key}`);
        continue;
      }
      normalized[key] = Math.round(value);
      continue;
    }
    if (typeof value !== "string") {
      errors.push(`invalid_type:${key}`);
      continue;
    }
    const s = value.trim().slice(0, 128);
    if (/secret|token|signature|password|Bearer\s/i.test(s)) {
      errors.push(`secret_like_value:${key}`);
      continue;
    }
    if (key === "placement" && !PLACEMENT_RE.test(s)) {
      errors.push("invalid_placement");
      continue;
    }
    if ((key === "operator" || key === "partner") && s && !SLUG_RE.test(s)) {
      errors.push(`invalid_slug:${key}`);
      continue;
    }
    if (key === "country" && s && !/^[A-Za-z]{2}$/.test(s)) {
      warnings.push("country_not_iso2");
    }
    normalized[key] = s;
  }

  if (!normalized.placement) {
    warnings.push("placement_missing");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}

export function clientMayOverride(field: string): boolean {
  return !(PROTECTED_ATTRIBUTION_FIELDS as readonly string[]).includes(field);
}
