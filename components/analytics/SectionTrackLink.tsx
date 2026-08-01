"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  trackHomepageSectionClick,
  type HomepageSectionId,
} from "@/lib/analytics/engagement";

export function SectionTrackLink({
  href,
  section,
  locale,
  className,
  children,
}: {
  href: string;
  section: HomepageSectionId;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackHomepageSectionClick(section, locale)}
      className={className}
    >
      {children}
    </Link>
  );
}
