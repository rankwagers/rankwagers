import type { CSSProperties, ReactNode } from "react";
import { type StatusTone } from "@/lib/ui/tokens";

/**
 * Section heading.
 *
 * `eyebrow` is optional: a section that carries the page's argument states its subject once, in the
 * heading. An eyebrow that paraphrases the heading is the heading said twice, and at 11px uppercase
 * it is the least legible way to say anything. Omit it on load-bearing sections; keep it where a
 * section genuinely belongs to a group.
 *
 * `lead` renders the description at reading size rather than as a caption. Use it when the sentence
 * beneath the heading is content — a stated limit, a sample note — rather than a subtitle.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  icon,
  lead = false,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  lead?: boolean;
}) {
  return (
    <div className="mb-6 md:mb-8">
      {eyebrow ? (
        <p className="rw3-label" style={{ margin: "0 0 4px" }}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className="rw3-title flex items-center gap-2"
        style={{ margin: 0 }}
      >
        {icon}
        {title}
      </h2>
      {description ? (
        <p
          style={
            lead
              ? {
                  margin: "10px 0 0",
                  maxWidth: "38rem",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--text)",
                }
              : {
                  margin: "6px 0 0",
                  maxWidth: "62ch",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--muted)",
                }
          }
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Empty state. Borderless: a drawn box around an absence emphasises the absence. Tone and generous
 * padding hold the space instead, so a section with nothing in it reads as composed rather than
 * broken.
 */
export function EmptySection({ text }: { text: string }) {
  return (
    <p
      className="px-5 py-8"
      style={{
        background: "var(--surface)",
        borderRadius: 6,
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--muted)",
        margin: 0,
      }}
      role="status"
    >
      {text}
    </p>
  );
}

/*
 * THE RECORD'S STATUS REGISTER. This component is shared by recent results, the archive table
 * and the transparency dashboard — all record surfaces. State is carried by a glyph plus the
 * Bible V3 status inks: won speaks --win, lost speaks --loss (bold — the record exists to not
 * hide them), void/pending/live drop to --muted with the neutral mark. V3 reconciliation of the
 * form-guide's monochrome map: the map's name and shape survive; the tones are now the scoped
 * v3 tokens rather than the retired hero inks.
 */
const STATUS_MONO: Record<
  StatusTone,
  { glyph: string; style: CSSProperties }
> = {
  won: { glyph: "✓", style: { color: "var(--win)" } },
  lost: { glyph: "✗", style: { color: "var(--loss)", fontWeight: 700 } },
  void: { glyph: "·", style: { color: "var(--muted)" } },
  pending: { glyph: "·", style: { color: "var(--muted)" } },
  live: { glyph: "·", style: { color: "var(--muted)" } },
};

export function StatusBadge({
  status,
  label,
}: {
  status: StatusTone;
  label: string;
}) {
  const mono = STATUS_MONO[status];
  return (
    <span
      className="rw3-pill uppercase"
      style={{ letterSpacing: "0.06em", ...mono.style }}
    >
      <span aria-hidden>{mono.glyph}</span>
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}
