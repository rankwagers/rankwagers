/**
 * Serializable brand list row for Server → Client props.
 * No secrets, no node:crypto, safe for Client Components.
 */

import type { OrderingBasis } from "@/lib/trust/rankingCriteria";

export type BrandListItem = {
  slug: string;
  name: string;
  logo?: string;
  crypto: boolean;
  rating: number;
  promoCode?: string;
  highlights: string[];
  bonusLabel: string;
  reviewHref: string;
  /** Internal `/go/…?ctx=r2…` or null when affiliate not configured. */
  signedHref: string | null;
  /**
   * POSITION IN THE LIST — not a verdict. Sprint 28.
   *
   * This is `index + 1`. It exists so analytics and affiliate attribution can record which card
   * a click came from. It is NOT a measured ranking and must never be rendered to a reader as
   * one: "third card" is a fact, "third best" is a claim nothing here supports. Consult
   * `orderingBasis` before presenting order as meaningful.
   */
  rank: number;
  /**
   * How this list's order was actually decided. `editorial` means curated placement, not score.
   * Surfaces must disclose it via `orderingDisclosure(orderingBasis)`.
   */
  orderingBasis: OrderingBasis;
};
