import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

/* The v3 footer: one quiet compliance line (18+ · responsible play ·
   BeGambleAware.org · the commission sentence, localized) and a muted row of
   legal destinations. No columns, no strapline — the shell stays out of the
   way (Bible V3: calm, dense, product-like). */

export function FooterV3({ dict, locale }: { dict: FullDictionary; locale: Locale }) {
  const p = dict.predictions as unknown as Record<string, string>;
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: "auto" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "10px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 14px",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        <span style={{ fontWeight: 600 }}>18+</span>
        <span>{p.v3PlayResponsibly}</span>
        <a
          href="https://www.begambleaware.org"
          rel="noopener noreferrer"
          target="_blank"
          style={{ textDecoration: "underline" }}
        >
          BeGambleAware.org
        </a>
        <span>{p.v3CommissionLine}</span>
      </div>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "0 20px 12px",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 14px",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        <Link href={`/${locale}/responsible-gambling`}>{dict.footer.responsible}</Link>
        <Link href={`/${locale}/terms`}>{dict.footer.terms}</Link>
        <Link href={`/${locale}/privacy`}>{dict.footer.privacy}</Link>
        <Link href={`/${locale}/methodology`}>{p.navMethodology}</Link>
        <Link href={`/${locale}/archive`}>{p.v3SeeRecord}</Link>
        {/* Explore doors (block I): the crawl/trust links the v2 footer
            carried — competitions, markets, operators — live on in v3. */}
        <Link href={`/${locale}/competitions`}>{p.cmpIndexTitle}</Link>
        <Link href={`/${locale}/markets`}>{p.nvMarkets}</Link>
        <Link href={`/${locale}/operators`}>{p.opIndexTitle}</Link>
      </div>
    </footer>
  );
}
