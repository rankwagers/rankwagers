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
      <h2 className="rw3-title">{title}</h2>
      {items.length ? (
        <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {items.map((item) => (
            <li key={`${item.entityType}-${item.slug}`}>
              <Link
                href={item.href}
                className="rw3-hoverable flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
              >
                <span>
                  {item.title}
                  {showReason && item.reason ? (
                    <span className="rw3-meta mt-0.5 block">
                      {item.reason}
                    </span>
                  ) : null}
                </span>
                <span className="rw3-label shrink-0">
                  {item.entityType}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
          {emptyLabel}
        </p>
      )}
    </section>
  );
}
