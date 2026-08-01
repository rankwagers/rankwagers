"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackMatchRelatedClick } from "@/lib/fixtures/analytics";

export function MatchRelatedLink({
  href,
  matchId,
  locale,
  kind,
  target,
  className,
  children,
}: {
  href: string;
  matchId: number;
  locale: string;
  kind: "fixture" | "team" | "competition";
  target: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className ?? "hover:text-brand"}
      onClick={() =>
        trackMatchRelatedClick({ matchId, locale, kind, target })
      }
    >
      {children}
    </Link>
  );
}
