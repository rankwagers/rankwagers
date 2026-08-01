import type { GraphEdge, GraphRelationKind } from "./entity";

export function edge(
  from: string,
  to: string,
  kind: GraphRelationKind
): GraphEdge {
  return { from, to, kind };
}

/** Undirected view for recommendations (both directions). */
export function expandUndirected(edges: readonly GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const item of edges) {
    const forward = `${item.from}->${item.to}:${item.kind}`;
    if (!seen.has(forward)) {
      seen.add(forward);
      out.push(item);
    }
    const reverse = `${item.to}->${item.from}:${item.kind}`;
    if (!seen.has(reverse)) {
      seen.add(reverse);
      out.push({ from: item.to, to: item.from, kind: item.kind });
    }
  }
  return out;
}
