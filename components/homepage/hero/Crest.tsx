"use client";

import { useEffect, useState } from "react";

/**
 * A club or competition mark, with a monogram fallback if the asset is missing or fails.
 *
 * `components/predictions/TeamLogo` was evaluated first and rejected for this surface: it carries
 * a rounded border and a muted fill, and it exposes four fixed size presets. The approved hero
 * sets bare marks at eight distinct pixel sizes (13 → 164) with no chrome behind them, so reusing
 * it would change the composition rather than match it.
 *
 * Sizing is explicit on both axes — never `auto`, which would let a crest render at its intrinsic
 * size before layout settles.
 */
export function Crest({
  src,
  name,
  size = 32,
  className = "",
  style,
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  // A new fixture may reuse this slot; a previous failure must not suppress the new mark.
  useEffect(() => setFailed(false), [src]);

  const initials =
    name
      .split(" ")
      .filter((word) => word.length > 2)
      .slice(0, 2)
      .map((word) => word[0])
      .join("") ||
    name[0] ||
    "?";

  if (!src || failed) {
    return (
      <span
        /*
         * Square, because radius is 0 everywhere in this scope — the monogram was the last
         * `rounded-full` left in the hero, and "just the badge" is the exception the v2 rules
         * name explicitly. A hairline states the mark's extent now that no fill rounds it.
         */
        className={`inline-flex shrink-0 items-center justify-center border border-[var(--hero-line)] bg-[rgb(32_30_29_/_0.05)] font-medium text-[var(--hero-ink-2)] ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, size * 0.32),
          fontFamily: "var(--font-hero-mono), ui-monospace, monospace",
          ...style,
        }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      /*
       * Decorative in every hero placement: the club, competition and fixture are stated in
       * adjacent text, so an alt string here would make a screen reader announce each name twice.
       */
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}
