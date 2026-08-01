import type { OperatorRegistryRow, PlacementRecord, QualityScore } from "./contracts";
import { scoreOperatorQuality, scorePlacementQuality } from "./scoring";

export type OperatorQualityRow = {
  operatorId: string;
  displayName: string;
  quality: QualityScore;
};

export type PlacementQualityRow = {
  placementId: string;
  quality: QualityScore;
};

export function buildOperatorQualityRows(
  operators: readonly OperatorRegistryRow[]
): OperatorQualityRow[] {
  return operators.map((op) => ({
    operatorId: op.operatorId,
    displayName: op.displayName,
    quality: scoreOperatorQuality(op),
  }));
}

export function buildPlacementQualityRows(
  placements: readonly PlacementRecord[],
  clickToRedirectByPlacement: Map<string, number | null>
): PlacementQualityRow[] {
  return placements.map((p) => ({
    placementId: p.placementId,
    quality: scorePlacementQuality(
      p,
      clickToRedirectByPlacement.get(p.placementId) ?? null
    ),
  }));
}
