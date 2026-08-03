import Crest from "./Crest";
import { tinted } from "./leagues";

/**
 * THE WATERMARK
 * The competition's own mark, set very large and deliberately cropped by the
 * edge of whatever contains it — the way a masthead crops a photograph. It
 * sits under everything, at an opacity where it registers as a shape and a
 * colour rather than as a logo. Never centred, never whole, never above type.
 *
 * The parent must be `relative` and `overflow-hidden`.
 */
export function LeagueWatermark({
  id,
  name,
  size = 320,
  opacity = 0.06,
  on = true,
  side = "left",
  className = "",
}: {
  id: number;
  name: string;
  size?: number;
  /** 0.05–0.08. Anything heavier stops being a watermark. */
  opacity?: number;
  on?: boolean;
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 transition-opacity duration-[var(--dur-reveal)] ease-[var(--ease-settle)] ${className}`}
      style={{
        opacity: on ? opacity : 0,
        // cropped by a third at the margin, and hung slightly high of centre
        [side]: -size * 0.3,
        transform: `translateY(-54%)`,
      }}
    >
      <Crest id={id} name={name} kind="league" size={size} />
    </span>
  );
}

/**
 * THE CUE
 * The smallest possible statement of competition identity: a two-pixel mark
 * in the competition's colour, set before its name. Used where a watermark
 * would be too much — supporting rows, live rows, labels.
 */
export function LeagueCue({ id, on = true }: { id: number; on?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="block h-2.5 w-[2px] shrink-0 transition-opacity duration-[var(--dur-respond)] ease-[var(--ease-respond)]"
      style={{ background: tinted(id, 1), opacity: on ? 1 : 0.35 }}
    />
  );
}
