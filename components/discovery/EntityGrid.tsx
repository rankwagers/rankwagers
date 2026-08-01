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
            className="block border border-border px-3 py-2.5 text-sm text-foreground transition-colors hover:border-brand/40 hover:text-brand"
          >
            <span className="font-medium">{item.title}</span>
            <span className="mt-1 block text-metadata uppercase tracking-label text-muted-foreground">
              {item.entityType}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
