import { buildPublicRouteInventory } from "./inventory";
import type { PublicRoute } from "./types";

/**
 * In-process route walker — does NOT fetch live URLs or crawl the network.
 * Expensive crawl reports are dashboard/API only.
 */
export function walkPublicRoutes(): PublicRoute[] {
  return buildPublicRouteInventory();
}

export function assertNoRuntimeCrawl(): void {
  // Intentional no-op marker for tests: this module must never call fetch().
}
