/* The five v3 empty-state illustrations, transcribed from the approved mock:
   120×90, single 1.5px stroke in --muted, round caps, exactly one --accent
   detail each. A section with nothing to say renders one of these plus one
   line of microcopy — never a placeholder table (Bible V3, empty-state law). */

import type { ReactNode } from "react";

const frame = {
  width: 120,
  height: 90,
  viewBox: "0 0 120 90",
  fill: "none",
  stroke: "var(--muted)",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Empty pitch, ball out beyond the touchline. */
export function IllustrationNoMatches() {
  return (
    <svg {...frame} aria-hidden="true" style={{ flex: "none" }}>
      <rect x="10" y="15" width="100" height="60" rx="2" />
      <path d="M60 15v60" />
      <circle cx="60" cy="45" r="10" />
      <path d="M10 33h14v24H10M110 33H96v24h14" />
      <circle cx="100" cy="82" r="4" stroke="var(--accent)" />
    </svg>
  );
}

/** Dashed offer tag with a location pin. */
export function IllustrationNoOffers() {
  return (
    <svg {...frame} aria-hidden="true" style={{ flex: "none" }}>
      <path d="M40 10l38 0 22 22-38 38-38-38V10z" strokeDasharray="4 4" />
      <path d="M50 22h.01" />
      <path d="M78 62c0 8-8 16-8 16s-8-8-8-16a8 8 0 0 1 16 0z" />
      <circle cx="70" cy="62" r="2.5" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

/** Camera with a clock face — the model has not run yet. */
export function IllustrationNoSnapshot() {
  return (
    <svg {...frame} aria-hidden="true" style={{ flex: "none" }}>
      <path d="M22 30h14l8-10h32l8 10h14v46H22z" />
      <circle cx="60" cy="52" r="14" />
      <path d="M60 44v8l5 3" />
      <circle cx="88" cy="38" r="2.5" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

/** Four dashed card slots, the first already filling in. */
export function IllustrationEditorEmpty() {
  return (
    <svg {...frame} aria-hidden="true" style={{ flex: "none" }}>
      <rect x="6" y="20" width="24" height="50" rx="2" strokeDasharray="4 4" />
      <rect x="34" y="20" width="24" height="50" rx="2" strokeDasharray="4 4" />
      <rect x="62" y="20" width="24" height="50" rx="2" strokeDasharray="4 4" />
      <rect x="90" y="20" width="24" height="50" rx="2" strokeDasharray="4 4" />
      <path d="M12 30h12M12 36h8" stroke="var(--accent)" />
    </svg>
  );
}

/** The ball rolled off the chart and out of the page. */
export function Illustration404() {
  return (
    <svg {...frame} aria-hidden="true" style={{ flex: "none" }}>
      <path d="M10 75h70V20" />
      <path d="M62 75a18 18 0 0 1 18-18" />
      <circle cx="98" cy="80" r="6" />
      <path d="M84 64l6 6" strokeDasharray="2 3" />
      <text
        x="14"
        y="52"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="16"
        fontWeight="600"
        fill="var(--muted)"
        stroke="none"
      >
        404
      </text>
      <circle cx="98" cy="80" r="1.5" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

/** The empty-state frame: illustration + title + one line, left-aligned. */
export function EmptyStateV3({
  illustration,
  title,
  line,
  action,
}: {
  illustration: ReactNode;
  title: string;
  line: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        padding: "24px 20px",
      }}
    >
      {illustration}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <span className="rw3-meta">{line}</span>
      </div>
      {action}
    </div>
  );
}
