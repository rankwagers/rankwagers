import { RW3_ICONS, type Rw3IconName } from "@/lib/v3/icons";

/* Inline SVG sprite + <use> renderer for the rw3 set. The sprite is mounted
   once per document (in the v3 layout chrome); every Icon after that is a
   two-node reference, which is what keeps a 48-row table of market pills
   cheap in HTML bytes. Stroke and fill ride on the use-site <svg> so the
   glyph inherits currentColor wherever it lands; the filled sub-paths carry
   their own fill inside the symbol. */

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {(Object.keys(RW3_ICONS) as Rw3IconName[]).map((name) => {
          const def = RW3_ICONS[name];
          return (
            <symbol key={name} id={`rw3-${name}`} viewBox="0 0 24 24">
              {def.d.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={def.fill?.includes(i) ? "currentColor" : "none"}
                />
              ))}
            </symbol>
          );
        })}
      </defs>
    </svg>
  );
}

export function Icon({
  name,
  size = 16,
  strokePx,
  className,
  label,
}: {
  name: Rw3IconName;
  size?: number;
  /**
   * Rendered stroke weight in DEVICE pixels (polish group 2): the sprite is
   * a 24-unit grid, so the viewBox stroke is scaled from this. Pills and
   * status labels render at size 20 with strokePx 1.75; omitted, the
   * grid-native 1.5 units apply (the block A default).
   */
  strokePx?: number;
  className?: string;
  /** Accessible name. Omit when adjacent text already names the meaning. */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokePx ? (strokePx * 24) / size : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none", display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <use href={`#rw3-${name}`} />
    </svg>
  );
}
