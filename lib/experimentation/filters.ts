import type {
  ExperimentEnvironment,
  ExperimentFilters,
  ExperimentSection,
  ExperimentStatus,
} from "./contracts";
import {
  EXPERIMENT_DEFAULT_PAGE_SIZE,
  EXPERIMENT_MAX_PAGE_SIZE,
} from "./contracts";

const SECTIONS: ExperimentSection[] = [
  "overview",
  "definitions",
  "assignments",
  "exposures",
  "metrics",
  "results",
  "guardrails",
  "issues",
  "methodology",
  "audit",
];

const STATUSES: ExperimentStatus[] = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "STOPPED",
  "COMPLETED",
  "ARCHIVED",
  "INVALIDATED",
];

function first(
  params: URLSearchParams | Record<string, string | string[] | undefined> | null,
  key: string,
): string | null {
  if (!params) return null;
  if (params instanceof URLSearchParams) {
    const v = params.get(key);
    return v && v.trim() ? v.trim() : null;
  }
  const raw = params[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && String(v).trim() ? String(v).trim() : null;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function parseExperimentSection(raw: string | null): ExperimentSection | null {
  if (!raw) return null;
  return SECTIONS.includes(raw as ExperimentSection)
    ? (raw as ExperimentSection)
    : null;
}

export function parseExperimentFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined> | null,
): ExperimentFilters {
  const statusRaw = first(params, "status");
  const envRaw = first(params, "environment");
  return {
    status:
      statusRaw && STATUSES.includes(statusRaw as ExperimentStatus)
        ? (statusRaw as ExperimentStatus)
        : null,
    environment:
      envRaw &&
      ["LOCAL", "TEST", "STAGING", "PRODUCTION"].includes(envRaw)
        ? (envRaw as ExperimentEnvironment)
        : null,
    q: first(params, "q"),
    offset: clampInt(first(params, "offset"), 0, 0, 100_000),
    limit: clampInt(
      first(params, "limit"),
      EXPERIMENT_DEFAULT_PAGE_SIZE,
      1,
      EXPERIMENT_MAX_PAGE_SIZE,
    ),
  };
}
