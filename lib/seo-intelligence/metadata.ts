/**
 * Metadata audit helpers — titles/descriptions come from application sources,
 * never fabricated by this layer.
 */

export type MetadataSignals = {
  title: string | null;
  description: string | null;
  h1: string | null;
  complete: boolean;
  notes: string[];
};

export function assessMetadata(input: {
  title?: string | null;
  description?: string | null;
  h1?: string | null;
}): MetadataSignals {
  const title = input.title?.trim() || null;
  const description = input.description?.trim() || null;
  const h1 = input.h1?.trim() || null;
  const notes: string[] = [];
  if (!title) notes.push("Missing title");
  if (!description) notes.push("Missing meta description");
  if (!h1) notes.push("Missing H1 signal in inventory");
  return {
    title,
    description,
    h1,
    complete: Boolean(title && description),
    notes,
  };
}
