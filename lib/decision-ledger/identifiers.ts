import { createHash } from "node:crypto";

export function predictionAggregateId(input: {
  date: string;
  marketKey: string;
  matchId: number;
}): string {
  return `pred:${input.date}:${input.marketKey}:${input.matchId}`;
}

export function publicationVersionId(
  aggregateId: string,
  publicationVersion: number,
): string {
  return `${aggregateId}:v${publicationVersion}`;
}

export function generationAggregateId(generationId: string): string {
  return `gen:${generationId}`;
}

export function combinationAggregateId(combinationId: string): string {
  return `combo:${combinationId}`;
}

export function mintEventId(seed: string): string {
  const h = createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 24);
  return `evt_${h}`;
}

export function hashCorrelationId(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}
