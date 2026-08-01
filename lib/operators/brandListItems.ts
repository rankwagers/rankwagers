/**
 * Server-only preparation of brand list rows with signed CTA hrefs.
 */

import "server-only";

import { isAffiliateConfigured } from "@/lib/affiliate";
import { bonusForLocale } from "@/lib/bonusForLocale";
import type { Brand } from "@/lib/brands";
import type { Locale } from "@/lib/i18n";
import { buildGoPath } from "@/lib/operators/go-path";
import type { BrandListItem } from "@/lib/operators/brandListTypes";
import { deriveOrderingBasis, listPosition } from "@/lib/trust/rankingCriteria";

export type { BrandListItem };

export function prepareBrandListItems(input: {
  brands: readonly Brand[];
  locale: Locale;
  subidPrefix: string;
  country?: string;
}): BrandListItem[] {
  /*
   * Sprint 28 - ordering transparency.
   *
   * The basis is derived ONCE for the whole list, because a list where only some operators are
   * scored cannot honestly be described as scored. With current data this resolves to
   * "editorial"; it upgrades itself to "scored" automatically if every brand gains complete
   * scores. The ORDER itself is unchanged - only the claim about it is now accurate.
   */
  const orderingBasis = deriveOrderingBasis(input.brands);
  return input.brands.map((brand, i) => {
    const subid = `${input.subidPrefix}_${listPosition(i)}`;
    const canGo = isAffiliateConfigured(brand);
    return {
      slug: brand.slug,
      name: brand.name,
      logo: brand.logo,
      crypto: Boolean(brand.crypto),
      rating: brand.rating,
      promoCode: brand.promoCode,
      highlights: brand.highlights.slice(0, 2),
      bonusLabel: bonusForLocale(brand, input.locale),
      reviewHref: `/${input.locale}/reviews/${brand.slug}`,
      signedHref: canGo
        ? buildGoPath({
            slug: brand.slug,
            placement: "brand_list",
            subid,
            locale: input.locale,
            country: input.country,
            availability: "unknown",
            deeplinkType: "homepage",
            // Attribution records WHERE the click came from. Not a verdict.
            operatorRank: listPosition(i),
          })
        : null,
      rank: listPosition(i),
      orderingBasis,
    };
  });
}
