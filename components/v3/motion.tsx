"use client";

/* The two v3 movements that need a trigger beyond CSS load-time animation:
   form dots fire once per viewport entry, so a row far below the fold still
   gets its 200ms sweep when the reader reaches it. Everything else in the
   motion law (band cards, lock tick, hovers) is pure CSS in globals.css.
   Under prefers-reduced-motion the CSS layer disables the animation and
   forces the dots visible — this island then does no observable work. */

import { useEffect, useRef } from "react";

export function FormDots({
  results,
  size = 5,
  label,
}: {
  /** Chronological, oldest first; true = the market hit. */
  results: readonly boolean[];
  size?: 4 | 5;
  /** Accessible summary, e.g. "8 of 10 hit". */
  label?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.classList.add("is-in");
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (results.length === 0) return null;

  return (
    <span
      ref={ref}
      className="rw3-dots"
      data-animate=""
      style={{ display: "flex", gap: size === 4 ? 2 : 3 }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {results.map((hit, i) => (
        <span
          key={i}
          className="rw3-dot"
          style={
            {
              width: size,
              height: size,
              background: hit ? "var(--win)" : "var(--loss)",
              "--rw3-i": i,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
