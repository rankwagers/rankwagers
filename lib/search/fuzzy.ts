/**
 * Bounded fuzzy matching for discovery search.
 * Prefer exact/prefix/contains tiers; fuzzy is a typo-tolerance fallback only.
 */

const MAX_QUERY_LEN = 32;
const MAX_CANDIDATE_LEN = 48;

/** Classic Levenshtein distance with early exit when distance exceeds max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (!la) return lb;
  if (!lb) return la;

  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[lb];
}

export function fuzzyDistanceAllowed(queryLength: number): number {
  if (queryLength < 4) return 0;
  if (queryLength < 7) return 1;
  return 2;
}

/** True when candidate is within typo distance of query (token or whole string). */
export function fuzzyMatches(candidate: string, query: string): boolean {
  if (!query || !candidate) return false;
  if (query.length > MAX_QUERY_LEN || candidate.length > MAX_CANDIDATE_LEN) return false;
  const max = fuzzyDistanceAllowed(query.length);
  if (max === 0) return false;
  if (editDistance(candidate, query, max) <= max) return true;

  // Token-level: any candidate token within distance of the full query
  const tokens = candidate.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length < 3) continue;
    if (editDistance(token, query, max) <= max) return true;
  }
  return false;
}
