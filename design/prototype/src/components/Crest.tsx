import { useState } from "react";

type CrestProps = {
  id: number;
  name: string;
  size?: number;
  kind?: "team" | "league";
  className?: string;
};

/** Club/competition mark with a graceful monogram fallback if the asset fails. */
export default function Crest({ id, name, size = 32, kind = "team", className = "" }: CrestProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink/[0.06] font-mono font-medium text-ink-2 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}
        aria-hidden="true"
      >
        {initials || name[0]}
      </span>
    );
  }

  return (
    <img
      src={`https://media.api-sports.io/football/${kind === "team" ? "teams" : "leagues"}/${id}.png`}
      alt={`${name} crest`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
