"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  trackHomepageSectionClick,
  type HomepageSectionId,
} from "@/lib/analytics/engagement";

export function SectionTrackLink({
  href,
  section,
  locale,
  className,
  style,
  children,
}: {
  href: string;
  section: HomepageSectionId;
  locale: string;
  className?: string;
  /** Table rows pass their competition tint through here (`--rw-tint`) for the hover rule. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackHomepageSectionClick(section, locale)}
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}
