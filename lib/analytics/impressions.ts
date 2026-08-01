/**
 * Impression tracking policy:
 * - IntersectionObserver threshold: 0.6 (60% of the entity must be visible)
 * - Fire once per stable entity id for the current page lifecycle
 * - Re-renders do not re-fire for ids already present in the set
 * - Filter/page changes may fire for newly visible entities only
 */
export const IMPRESSION_INTERSECTION_THRESHOLD = 0.6;

export function rememberImpression(
  seen: Set<string>,
  entityId: string
): boolean {
  if (!entityId || seen.has(entityId)) return false;
  seen.add(entityId);
  return true;
}
