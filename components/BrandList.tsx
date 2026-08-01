import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import type { BrandListItem } from "@/lib/operators/brandListTypes";
import { BrandLogo, BrandLogoFallback } from "./BrandLogo";
import { StarRating } from "./StarRating";
import { Star } from "lucide-react";

function rankBadge(i: number): string {
  return String(i + 1).padStart(2, "0");
}

/** Presentational brand list — receives pre-signed hrefs only (no crypto). */
export function BrandList({
  items,
  dict,
}: {
  items: BrandListItem[];
  dict: FullDictionary;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const isTop = i === 0;
        return (
          <div
            key={item.slug}
            className={`card relative animate-fade-up p-5 sm:p-6 ${
              isTop ? "ring-1 ring-brand/30" : ""
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {isTop && (
              <span className="absolute -top-3 left-6 badge-gold">
                <Star className="h-3 w-3" aria-hidden /> {dict.home.topPick}
              </span>
            )}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex items-center gap-4 lg:w-[15.5rem] lg:shrink-0">
                <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted py-1">
                  <span className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                    {dict.table.rank}
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-brand">
                    {rankBadge(i)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5 text-center sm:items-start sm:text-left">
                  {item.logo ? (
                    <BrandLogo
                      src={item.logo}
                      alt={`${item.name} logo`}
                      size="lg"
                    />
                  ) : (
                    <BrandLogoFallback label={item.name} size="lg" />
                  )}
                  <div className="min-w-0 w-full">
                    <div className="truncate text-lg font-semibold tracking-display text-foreground">
                      {item.name}
                    </div>
                    <Link
                      href={item.reviewHref}
                      className="text-sm font-medium text-muted-foreground hover:text-brand"
                    >
                      {dict.home.review} →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex-1 border-t border-border pt-5 lg:border-t-0 lg:pt-0">
                <div className="text-xs font-semibold uppercase tracking-label text-muted-foreground">
                  {dict.home.bonusLabel}
                </div>
                <div className="mt-1 text-base font-semibold leading-snug text-brand sm:text-lg">
                  {item.bonusLabel}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.promoCode && (
                    <span className="chip border-brand/40 text-brand-light">
                      {dict.cta.promoCode}: {item.promoCode}
                    </span>
                  )}
                  {item.crypto && <span className="chip">₿ Crypto</span>}
                  {item.highlights.map((h) => (
                    <span key={h} className="chip">
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              <div className="lg:w-36 lg:shrink-0">
                <StarRating value={item.rating} />
                <div className="mt-1 text-xs text-muted-foreground">
                  {dict.home.ratingLabel}
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2 lg:w-44 lg:shrink-0">
                {item.signedHref ? (
                  <a
                    href={item.signedHref}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                    className="btn-primary w-full"
                  >
                    {dict.cta.claimBonus}
                  </a>
                ) : (
                  <Link
                    href={item.reviewHref}
                    className="btn-primary w-full text-center"
                  >
                    {dict.home.review}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
