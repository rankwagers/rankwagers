import Link from "next/link";
import type { RecommendationItem } from "@/lib/discovery";

export function EntityGrid({
  items,
  labelledBy,
}: {
  items: RecommendationItem[];
  labelledBy?: string;
}) {
  if (!items.length) return null;
  return (
    <ul
      className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      aria-labelledby={labelledBy}
    >
      {items.map((item) => (
        <li key={`${item.entityType}-${item.slug}`}>
          <Link
            href={item.href}
            className="rw3-hoverable block border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
            style={{ borderRadius: 6 }}
          >
            <span className="font-medium">{item.title}</span>
            <span className="rw3-label mt-1 block">
              {item.entityType}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
