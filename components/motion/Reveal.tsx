"use client";

import type { ElementType, ReactNode } from "react";
import { useReveal } from "@/components/homepage/hero/motion";

/**
 * A scroll-revealed block.
 *
 * The research page is server-rendered, so the observer needs one small client boundary. This is
 * it — the hook, the class and the `--i` stagger index, nothing else. It reuses the hero's
 * `useReveal` rather than adding a second observer implementation to keep in sync.
 *
 * MOTION RULE 3: the element resolves — opacity, a 6px blur and a 12px rise together — it does not
 * slide in. Every value comes from the `.rw-hero` scope, so this component sets no timing itself.
 *
 * ZERO CLS: only opacity, transform and filter are animated. The block occupies its final height
 * from the first frame, before the observer has fired.
 *
 * Reduced motion is handled twice over: `useReveal` adds `is-in` immediately without observing,
 * and the stylesheet neutralises the transition and zeroes `--travel` / `--focus`.
 */
export function Reveal({
  children,
  index = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Position within a staggered group — drives `--i`, which the stylesheet turns into delay. */
  index?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      style={{ "--i": index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
