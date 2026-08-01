import type { CalibrationFilters } from "./contracts";

/** Explicit cohort definition string — prevent hidden filtering. */
export function formatCohortDefinition(
  window: { from: string; to: string },
  filters: CalibrationFilters,
  extras: Record<string, string | null | undefined> = {},
): string {
  const parts = [
    `from=${window.from}`,
    `to=${window.to}`,
    filters.market ? `market=${filters.market}` : null,
    filters.competition ? `competition=${filters.competition}` : null,
    filters.country ? `country=${filters.country}` : null,
    filters.riskMode ? `riskMode=${filters.riskMode}` : null,
    filters.q ? `q=${filters.q}` : null,
    ...Object.entries(extras).map(([k, v]) => (v ? `${k}=${v}` : null)),
  ].filter(Boolean);
  return parts.join("; ");
}
