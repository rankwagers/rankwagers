import Link from "next/link";
import type { RecommendationItem } from "@/lib/discovery";

export function DiscoveryPanel({
  title,
  items,
  emptyLabel = "No related entities yet.",
  showReason = false,
}: {
  title: string;
  items: RecommendationItem[];
  emptyLabel?: string;
  showReason?: boolean;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      {items.length ? (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={`${item.entityType}-${item.slug}`}>
              <Link
                href={item.href}
                className="flex items-baseline justify-between gap-3 py-2.5 text-sm text-foreground hover:text-brand"
              >
                <span>
                  {item.title}
                  {showReason && item.reason ? (
                    <span className="mt-0.5 block text-metadata text-muted-foreground">
                      {item.reason}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-metadata uppercase tracking-label text-muted-foreground">
                  {item.entityType}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  );
}
