"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  trackEntityNavigation,
  trackGraphNavigation,
  trackRecommendationClick,
  trackRelatedClick,
} from "@/lib/analytics/knowledgeGraph";
import type { GraphEntityType } from "@/lib/knowledge-graph/entity";

export function GraphNavLink({
  href,
  fromType,
  fromSlug,
  toType,
  toSlug,
  locale,
  section,
  intent = "graph",
  className,
  children,
}: {
  href: string;
  fromType: GraphEntityType;
  fromSlug: string;
  toType: GraphEntityType;
  toSlug: string;
  locale: string;
  section?: string;
  intent?: "graph" | "related" | "recommendation" | "entity";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        const base = {
          fromType,
          fromSlug,
          toType,
          toSlug,
          locale,
        };
        if (intent === "related") trackRelatedClick(base);
        else if (intent === "recommendation") trackRecommendationClick(base);
        else if (intent === "entity") trackEntityNavigation(base);
        else {
          trackGraphNavigation({ ...base, section: section ?? "graph" });
          trackEntityNavigation(base);
        }
      }}
    >
      {children}
    </Link>
  );
}
