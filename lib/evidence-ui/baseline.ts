import type { BaselineKind, BaselineRelation, BaselineView } from "./types";

/** Near baseline when absolute delta ≤ 3 percentage points (or ≤ 0.15 for non-percent scales). */
const NEAR_PP = 3;

export function classifyBaselineRelation(
  value: number | null | undefined,
  baseline: number | null | undefined,
  options?: { nearThreshold?: number }
): BaselineRelation {
  if (
    value == null ||
    baseline == null ||
    !Number.isFinite(value) ||
    !Number.isFinite(baseline)
  ) {
    return "unavailable";
  }
  const near = options?.nearThreshold ?? NEAR_PP;
  const delta = value - baseline;
  if (Math.abs(delta) <= near) return "near";
  return delta > 0 ? "above" : "below";
}

export function buildBaselineView(input: {
  kind: BaselineKind;
  label: string;
  value: number | null;
  baseline: number | null;
  unit?: "percent" | "number";
}): BaselineView {
  const unit = input.unit ?? "percent";
  const relation = classifyBaselineRelation(input.value, input.baseline);
  const displayValue =
    input.baseline == null
      ? "—"
      : unit === "percent"
        ? `${Math.round(input.baseline)}%`
        : String(input.baseline);

  let deltaDisplay: string | undefined;
  if (
    input.value != null &&
    input.baseline != null &&
    Number.isFinite(input.value) &&
    Number.isFinite(input.baseline)
  ) {
    const delta = input.value - input.baseline;
    deltaDisplay =
      unit === "percent"
        ? `${delta >= 0 ? "+" : ""}${Math.round(delta)} pp`
        : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;
  }

  return {
    kind: input.kind,
    label: input.label,
    value: input.baseline,
    displayValue,
    relation,
    deltaDisplay,
  };
}
