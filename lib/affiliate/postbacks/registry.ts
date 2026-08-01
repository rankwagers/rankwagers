import { BRANDS } from "@/lib/brands";
import { disabledAdapter } from "./adapters/disabled";
import type { PostbackAdapterDefinition } from "./types";

/** Future real adapters register here — none configured today. */
export const MANUAL_POSTBACK_ADAPTERS: PostbackAdapterDefinition[] = [];

let cached: PostbackAdapterDefinition[] | null = null;

export function listPostbackAdapters(): PostbackAdapterDefinition[] {
  if (cached) return cached;
  const byId = new Map(
    BRANDS.map((b) => [b.slug, disabledAdapter(b.slug)] as const)
  );
  for (const adapter of MANUAL_POSTBACK_ADAPTERS) {
    byId.set(adapter.operatorId, adapter);
  }
  cached = [...byId.values()];
  return cached;
}

export function resetPostbackRegistryCache(): void {
  cached = null;
}

export function getPostbackAdapter(
  operatorId: string
): PostbackAdapterDefinition | undefined {
  return listPostbackAdapters().find((a) => a.operatorId === operatorId);
}

export function postbackAdapterStats(
  adapters: readonly PostbackAdapterDefinition[] = listPostbackAdapters()
) {
  return {
    total: adapters.length,
    configured: adapters.filter((a) => a.status === "configured").length,
    disabled: adapters.filter(
      (a) => a.status === "disabled" || a.status === "not_configured"
    ).length,
  };
}
