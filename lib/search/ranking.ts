import { fuzzyMatches } from "./fuzzy";
import { MATCH_TIER_RANK, type MatchTier, type SearchDocument } from "./types";

export type RankedHit = {
  document: SearchDocument;
  tier: MatchTier;
};

function matchTier(doc: SearchDocument, query: string): MatchTier | null {
  if (!query) return null;

  if (doc.normalizedSlug === query || doc.normalizedSlug.replace(/-/g, " ") === query) {
    return "exact_slug";
  }
  if (doc.normalizedTitle === query) return "exact_title";
  if (doc.normalizedAliases.some((alias) => alias === query)) return "exact_alias";

  const slugAsWords = doc.normalizedSlug.replace(/-/g, " ");
  if (
    slugAsWords.startsWith(query) ||
    doc.normalizedTitle.startsWith(query) ||
    doc.normalizedAliases.some((alias) => alias.startsWith(query)) ||
    doc.normalizedKeywords.some((kw) => kw.startsWith(query))
  ) {
    return "prefix";
  }

  if (
    slugAsWords.includes(query) ||
    doc.normalizedTitle.includes(query) ||
    doc.normalizedAliases.some((alias) => alias.includes(query)) ||
    doc.normalizedKeywords.some((kw) => kw.includes(query))
  ) {
    return "contains";
  }

  const fuzzyCandidates = [
    slugAsWords,
    doc.normalizedTitle,
    ...doc.normalizedAliases,
    ...doc.normalizedKeywords,
  ];
  if (fuzzyCandidates.some((candidate) => fuzzyMatches(candidate, query))) {
    return "fuzzy";
  }

  return null;
}

/** Rank documents for a normalized query. Never fabricates relevance. */
export function rankDocuments(
  documents: readonly SearchDocument[],
  normalizedQuery: string
): RankedHit[] {
  const hits: RankedHit[] = [];
  for (const document of documents) {
    if (!document.searchable || !document.active) continue;
    const tier = matchTier(document, normalizedQuery);
    if (!tier) continue;
    hits.push({ document, tier });
  }

  hits.sort((left, right) => {
    const tierDelta = MATCH_TIER_RANK[left.tier] - MATCH_TIER_RANK[right.tier];
    if (tierDelta !== 0) return tierDelta;
    if (right.document.graphScore !== left.document.graphScore) {
      return right.document.graphScore - left.document.graphScore;
    }
    if (right.document.popularityWeight !== left.document.popularityWeight) {
      return right.document.popularityWeight - left.document.popularityWeight;
    }
    if (right.document.integrityScore !== left.document.integrityScore) {
      return right.document.integrityScore - left.document.integrityScore;
    }
    return left.document.title.localeCompare(right.document.title);
  });

  return hits;
}
