import { Icon } from "@/components/v3/Icon";

/* The one way a commercial element says what it is (Bible V3, compliance):
   the sponsored glyph + the localized "Sponsored · 18+" string. Every
   commercial surface renders this — rails, offer of the day, price rows. */

export function SponsoredLabel({ text, size = 10 }: { text: string; size?: 10 | 11 }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: size,
        color: "var(--muted)",
        whiteSpace: "nowrap",
      }}
    >
      <Icon name="sponsored" size={size + 1} />
      {text}
    </span>
  );
}
