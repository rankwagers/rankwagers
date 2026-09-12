/* ============================================================================
   THE OPERATOR WORDMARK CHIP (v3 polish 2, group 2).

   One component, three sizes: rail (28px tall, ≤96px wide), card (32px,
   ≤110px), row-button (16px, ≤56px). Wordmarks — dark and colored — sit on
   a LIGHT chip (#f5f5f5, radius 6, 4px padding) so every brand asset reads
   on the dark theme without tinting. The registry carries no white/mono
   variants today; the day it does, that variant renders instead and the
   chip can darken.

   A brand with no asset renders its NAME as text in the same chip — never
   a letter mark (probed): two letters on a chip read as a logo we do not
   have the right to invent.
   ========================================================================== */

const SIZES = {
  rail: { height: 28, maxWidth: 96, fontSize: 10 },
  card: { height: 32, maxWidth: 110, fontSize: 11 },
  row: { height: 16, maxWidth: 56, fontSize: 8 },
} as const;

export type OperatorLogoVariant = keyof typeof SIZES;

export function OperatorLogo({
  logo,
  name,
  variant,
}: {
  logo: string | null;
  name: string;
  variant: OperatorLogoVariant;
}) {
  const size = SIZES[variant];
  return (
    <span
      aria-hidden
      title={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: size.height + 8,
        maxWidth: size.maxWidth + 8,
        padding: 4,
        background: "#f5f5f5",
        borderRadius: 6,
        flex: "none",
        overflow: "hidden",
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          style={{
            height: size.height,
            maxWidth: size.maxWidth,
            width: "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: size.fontSize,
            fontWeight: 600,
            color: "#161616",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
      )}
    </span>
  );
}
