import type { ReactNode } from "react";
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
      {/*
        Section opener. A short heavy rule above the heading — the device a broadsheet uses to mark
        where one piece ends and the next begins. It replaces nothing and carries no meaning on its
        own, which is exactly why it works: it is a pause, and a page with no pauses reads as a
        dashboard no matter how good its type is.

        `aria-hidden` because it is punctuation, not content.
      */}
      <span
        aria-hidden
        className="mb-5 block h-[3px] w-10 bg-[var(--ink-primary)] md:mb-6"
      />
      {eyebrow ? (
        <p className="mb-1 text-metadata font-medium uppercase tracking-label text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className="flex items-center gap-2 font-display text-2xl font-semibold leading-tight tracking-display text-foreground md:text-3xl"
      >
        {icon}
        {title}
      </h2>
      {description ? (
        <p
          className={
            lead
              ? "mt-4 max-w-[38rem] text-base leading-relaxed text-[var(--ink-secondary)] md:text-lg"
              : "mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)]"
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
      className="rounded-lg bg-[var(--canvas-secondary)] px-5 py-8 text-body-sm leading-relaxed text-muted-foreground"
      role="status"
    >
      {text}
    </p>
  );
}

/*
 * MONOCHROME, PER THE FORM-GUIDE LANGUAGE. This component is shared by recent results, the
 * archive table and the transparency dashboard — all record surfaces, where "Grey = Historical"
 * holds and colour would rank outcomes the record itself does not. State is carried by a glyph
 * and a weight, never a hue: won is ink with its tick, lost is ink with its cross (bold — the
 * record exists to not hide them), void and pending drop to the secondary ink with the neutral
 * mark. The change lands once, here, exactly as the homepage note promised it would.
 */
const STATUS_MONO: Record<StatusTone, { glyph: string; tone: string }> = {
  won: { glyph: "✓", tone: "border-[var(--hero-ink,#201e1d)] text-[var(--hero-ink,#201e1d)]" },
  lost: {
    glyph: "✗",
    tone: "border-[var(--hero-ink,#201e1d)] font-bold text-[var(--hero-ink,#201e1d)]",
  },
  void: { glyph: "·", tone: "border-[var(--border-subtle)] text-[var(--ink-secondary)]" },
  pending: { glyph: "·", tone: "border-[var(--border-subtle)] text-[var(--ink-secondary)]" },
  live: { glyph: "·", tone: "border-[var(--border-subtle)] text-[var(--ink-secondary)]" },
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-1 text-metadata font-medium uppercase tracking-label ${mono.tone}`}
    >
      <span aria-hidden>{mono.glyph}</span>
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}
