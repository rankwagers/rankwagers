import type { ReactNode } from "react";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/tokens";

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

export function EmptySection({ text }: { text: string }) {
  return (
    <p
      className="rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 py-6 text-sm text-muted-foreground"
      role="status"
    >
      {text}
    </p>
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: StatusTone;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-metadata font-medium uppercase tracking-label ${STATUS_TONE_CLASS[status]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}
