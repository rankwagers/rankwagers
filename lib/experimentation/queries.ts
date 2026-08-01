import "server-only";
import { experimentTemplates } from "./definitions";
import type { ExperimentDefinition } from "./contracts";

export function listExperimentDefinitions(): ExperimentDefinition[] {
  return experimentTemplates();
}

export function getExperimentDefinition(
  id: string,
): ExperimentDefinition | null {
  return experimentTemplates().find((d) => d.id === id) ?? null;
}
