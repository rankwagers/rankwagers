/* The operator logo chip (v3 polish group 1). The real brand asset — the
   same file the operator cards use — on a surface chip; the letter mark
   survives only as the fallback for a brand with no asset. Mono-tint is
   retired. 20px in rails, 24px on cards. */

export function OperatorLogo({
  logo,
  mark,
  name,
  size,
}: {
  logo: string | null;
  /** Letter fallback for a brand without an asset. */
  mark: string;
  name: string;
  size: 20 | 24;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--line)",
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
          width={size - 4}
          height={size - 4}
          style={{ objectFit: "contain" }}
          title={name}
        />
      ) : (
        <span style={{ fontSize: size <= 20 ? 7 : 8, fontWeight: 600 }}>{mark}</span>
      )}
    </span>
  );
}
