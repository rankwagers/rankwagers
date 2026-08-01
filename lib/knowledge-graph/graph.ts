import type { GraphEdge, GraphEntity, GraphEntityType, GraphRelationKind } from "./entity";
import { buildKnowledgeGraph, type GraphSnapshot } from "./registry";
import { expandUndirected } from "./relationships";

export class KnowledgeGraph {
  private readonly byId: Map<string, GraphEntity>;
  private readonly undirected: GraphEdge[];

  constructor(private readonly snapshot: GraphSnapshot = buildKnowledgeGraph()) {
    this.byId = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
    this.undirected = expandUndirected(snapshot.edges);
  }

  getEntity(id: string): GraphEntity | undefined {
    return this.byId.get(id);
  }

  listByType(type: GraphEntityType): GraphEntity[] {
    return this.snapshot.entities.filter((entity) => entity.type === type);
  }

  neighbors(
    id: string,
    options: { kinds?: readonly GraphRelationKind[]; types?: readonly GraphEntityType[] } = {}
  ): Array<{ entity: GraphEntity; kind: GraphRelationKind }> {
    return this.undirected
      .filter((edge) => edge.from === id)
      .filter((edge) => !options.kinds || options.kinds.includes(edge.kind))
      .map((edge) => {
        const entity = this.byId.get(edge.to);
        return entity ? { entity, kind: edge.kind } : null;
      })
      .filter((row): row is { entity: GraphEntity; kind: GraphRelationKind } => Boolean(row))
      .filter((row) => !options.types || options.types.includes(row.entity.type));
  }

  relatedEntities(
    id: string,
    types: readonly GraphEntityType[],
    limit = 8
  ): GraphEntity[] {
    const seen = new Set<string>([id]);
    const out: GraphEntity[] = [];
    for (const { entity } of this.neighbors(id, { types })) {
      if (seen.has(entity.id)) continue;
      seen.add(entity.id);
      out.push(entity);
      if (out.length >= limit) break;
    }
    return out;
  }

  hasOrphans(indexableTypes: readonly GraphEntityType[] = [
    "competition",
    "market",
    "operator",
    "team",
    "season",
  ]): GraphEntity[] {
    return this.snapshot.entities.filter((entity) => {
      if (!indexableTypes.includes(entity.type)) return false;
      return this.neighbors(entity.id).length === 0;
    });
  }

  toJSON(): GraphSnapshot {
    return this.snapshot;
  }
}

let cached: KnowledgeGraph | undefined;

export function getKnowledgeGraph(): KnowledgeGraph {
  cached ??= new KnowledgeGraph();
  return cached;
}

/** Test helper */
export function resetKnowledgeGraphCache(): void {
  cached = undefined;
}
