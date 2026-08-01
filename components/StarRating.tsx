import { Star } from "lucide-react";

/**
 * Star rating.
 *
 * Spec §12 retires dingbats: `★` has no stroke weight, no optical sizing and no baseline
 * alignment, and renders differently on every platform. The partial-fill technique is unchanged —
 * a width-clipped second row painted over the first — only the glyph source is now the single
 * icon family.
 */
export function StarRating({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const px = size === "sm" ? 14 : 16;
  const stars = Array.from({ length: 5 });

  return (
    <span className="inline-flex items-center gap-2" aria-label={`${value.toFixed(1)} / 5`}>
      <span className="relative inline-flex leading-none" aria-hidden>
        <span className="inline-flex text-[var(--border-strong)]">
          {stars.map((_, index) => (
            <Star key={index} width={px} height={px} strokeWidth={1.5} />
          ))}
        </span>
        <span
          className="absolute inset-0 inline-flex overflow-hidden text-brand"
          style={{ width: `${pct}%` }}
        >
          {stars.map((_, index) => (
            <Star key={index} width={px} height={px} strokeWidth={1.5} fill="currentColor" />
          ))}
        </span>
      </span>
      <span className="text-sm font-semibold text-foreground">{value.toFixed(1)}</span>
    </span>
  );
}
