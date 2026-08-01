"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { FullDictionary } from "@/lib/dictionaries";
import type { BrandListItem } from "@/lib/operators/brandListTypes";
import { BrandList } from "./BrandList";
import { OrderingDisclosure } from "./trust/OrderingDisclosure";

/**
 * Client filter UI only. Signed CTA hrefs must be prepared on the server
 * via prepareBrandListItems — never import buildGoPath here.
 */
export function BrandListSection({
  items,
  dict,
  initialCryptoOnly = false,
  hideCryptoFilter = false,
}: {
  items: BrandListItem[];
  dict: FullDictionary;
  initialCryptoOnly?: boolean;
  hideCryptoFilter?: boolean;
}) {
  // Sprint 33: locale for the criteria-page link. `useParams()` is the established pattern for
  // a client component needing the locale here (see LiveFeedPanel); threading a prop would
  // require changing every caller for a link.
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : undefined;
  const [cryptoOnly, setCryptoOnly] = useState(initialCryptoOnly);
  const filtered = useMemo(
    () => (cryptoOnly ? items.filter((b) => b.crypto) : items),
    [items, cryptoOnly]
  );

  /*
   * Sprint 29 — ordering disclosure.
   *
   * Rendered ABOVE the list and above the filter, so every reader of every brand list meets it
   * before the first operator. This is the single choke point for `/best-betting-sites`,
   * `/best-crypto-betting-sites` and `/bonuses`, which is why the disclosure lives here rather
   * than being repeated on each page where one could be forgotten.
   *
   * The basis is computed server-side over the FULL list and is still valid after the crypto
   * filter: filtering removes elements without reordering them, and a subsequence of a
   * descending sequence is still descending. `comparisonDisclosure.test.ts` proves that on real
   * brand data rather than leaving it as an assumption.
   *
   * `items[0]` is safe here because an empty list renders no disclosure — there is nothing whose
   * ordering could be claimed.
   */
  const basis = items[0]?.orderingBasis ?? null;

  return (
    <div>
      {basis ? <OrderingDisclosure basis={basis} locale={locale} className="mb-4" /> : null}
      {!hideCryptoFilter && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCryptoOnly(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              !cryptoOnly
                ? "bg-brand text-background"
                : "border border-border text-[var(--ink-secondary)] hover:border-border"
            }`}
          >
            {dict.home.filterAll}
          </button>
          <button
            type="button"
            onClick={() => setCryptoOnly(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              cryptoOnly
                ? "bg-brand text-background"
                : "border border-border text-[var(--ink-secondary)] hover:border-border"
            }`}
          >
            {dict.home.filterCrypto}
          </button>
        </div>
      )}
      <BrandList items={filtered} dict={dict} />
    </div>
  );
}
