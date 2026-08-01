import type { ReactNode } from "react";

/**
 * Shared AI-search-friendly section chrome for entity destinations.
 * Keeps hierarchy predictable: Summary → Key facts → Evidence → Related → Navigation.
 */

export function SemanticSection({
  id,
  title,
  children,
  as: Tag = "section",
}: {
  id: string;
  title: string;
  children: ReactNode;
  as?: "section" | "div";
}) {
  const headingId = `${id}-heading`;
  return (
    <Tag id={id} aria-labelledby={headingId} className="scroll-mt-28">
      <h2 id={headingId} className="font-display text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </Tag>
  );
}

export const ENTITY_SECTION_IDS = {
  summary: "overview",
  keyFacts: "key-facts",
  evidence: "evidence",
  prediction: "predictions",
  related: "related",
  navigation: "continue",
} as const;
