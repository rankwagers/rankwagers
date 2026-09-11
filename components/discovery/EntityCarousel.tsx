import Link from "next/link";
import type { RecommendationItem } from "@/lib/discovery";

/** Accessible horizontal list (keyboard scroll via overflow; SSR links). */
export function EntityCarousel({
  items,
  labelledBy,
}: {
  items: RecommendationItem[];
  labelledBy?: string;
}) {
  if (!items.length) return null;
  return (
    <ul
      className="mt-3 flex gap-2 overflow-x-auto pb-2"
      aria-labelledby={labelledBy}
      tabIndex={0}
      role="list"
    >
      {items.map((item) => (
        <li key={`${item.entityType}-${item.slug}`} className="min-w-[10.5rem] shrink-0">
          <Link
            href={item.href}
            className="rw3-hoverable block border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
            style={{ borderRadius: 6 }}
          >
            <span className="block font-medium">{item.title}</span>
            <span className="rw3-label mt-1 block">
              {item.entityType}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
