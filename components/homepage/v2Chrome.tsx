import Link from "next/link";
import type { ReactNode } from "react";
import { flagForCountry } from "@/lib/footystats/flags";

/* ============================================================================
   SHARED V2 CHROME — the devices every converted island uses
   ----------------------------------------------------------------------------
   Six sections were converted in this pass and every one of them needed the
   same four things: a section opening, a bordered mono button, a mono chip and
   a league cell. Written once here rather than six times, because six copies
   of a 2px rule is how a design language drifts back into six dialects.

   Nothing here holds state or reads data. These are shapes.
   ========================================================================== */

/**
 * A section opening: the 40×2px rule, a mono eyebrow, the heading, the standfirst.
 *
 * The heading sits on the ladder's middle step (46 — headings are 34 / 46 / 58 and nothing
 * between). The map draws it at 40, which is not on the ladder; the doc is the law and says so
 * outright, so the ladder wins where the two disagree.
 */
export function V2SectionOpen({
  eyebrow,
  title,
  description,
  headingId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  headingId?: string;
}) {
  return (
    <div className="mb-6">
      <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
      {eyebrow ? <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{eyebrow}</p> : null}
      <h2
        id={headingId}
        className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-2.5 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A bordered mono button — the map's only button shape.
 *
 * Bordered, never filled: a solid slab is the loudest thing available and this page spends that
 * weight on figures. Hover inverts, which states the affordance without adding a colour.
 *
 * The arrow is OPTIONAL and defaults to on. The `→ →` on the archive CTA came from a label that
 * already ended in an arrow meeting a component that appended one; making the arrow this
 * component's property, and never the label's, is what stops that recurring.
 */
export function V2Button({
  href,
  children,
  arrow = true,
  external = false,
  ...rest
}: {
  href: string;
  children: ReactNode;
  arrow?: boolean;
  external?: boolean;
  [key: string]: unknown;
}) {
  const className =
    "rw-m group inline-flex items-center gap-2.5 border border-[var(--hero-ink)] px-3 py-2 tracking-[0.1em] text-[var(--hero-ink)] transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]";
  const inner = (
    <>
      {children}
      {arrow ? (
        <span
          aria-hidden
          className="inline-block transition-transform duration-[var(--dur-respond)] ease-[var(--ease-settle)] group-hover:translate-x-1"
        >
          →
        </span>
      ) : null}
    </>
  );

  if (external) {
    return (
      <a href={href} className={className} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {inner}
    </Link>
  );
}

/** A mono chip: bordered, uppercase, inverting when it is the selected one. */
export function V2Chip({
  href,
  label,
  count,
  note,
  selected = false,
  ...rest
}: {
  href: string;
  label: string;
  count?: string;
  note?: string;
  selected?: boolean;
  [key: string]: unknown;
}) {
  return (
    <Link
      href={href}
      className={`rw-m inline-flex items-baseline gap-2.5 border border-[var(--hero-line)] px-3 py-2 tracking-[0.1em] transition-colors duration-[var(--dur-respond)] ease-[var(--ease-settle)] ${
        selected
          ? "bg-[var(--hero-ink)] text-[var(--hero-canvas)]"
          : "text-[var(--hero-ink)] hover:border-[var(--hero-ink)]"
      }`}
      {...rest}
    >
      {label}
      {count ? <span className="rw-tnum opacity-60">{count}</span> : null}
      {note ? <span className="opacity-60">{note}</span> : null}
    </Link>
  );
}

/**
 * A league cell: the country's flag above its competition.
 *
 * THE FLAG IS OMITTED WHEN THE COUNTRY IS. A provider row that carried no country renders the
 * competition alone — never a white flag, which would stand in for an observation nobody made.
 * The flag is an emoji rather than an asset, so a cell costs no request and cannot half-load.
 */
export function V2LeagueCell({
  country,
  league,
}: {
  country?: string;
  league: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-2">
      {country ? (
        <span aria-hidden className="shrink-0 text-[13px] leading-none">
          {flagForCountry(country)}
        </span>
      ) : null}
      <span className="min-w-0">
        {country ? (
          <span className="rw-m block truncate font-bold text-[var(--hero-ink)]">{country}</span>
        ) : null}
        <span className="rw-m block truncate text-[var(--hero-ink-2)]">{league}</span>
      </span>
    </span>
  );
}

/**
 * A settled outcome: a boxed glyph and word.
 *
 * LOST CARRIES THE ACCENT. That is deliberate and it is the opposite of the usual instinct: the
 * loud colour goes on the losses, because this is the section that exists to not hide them. A
 * record that draws its wins in colour and its losses in grey has decided which one it wants read.
 *
 * Won is ink on ground; void is the rule tone, because a fixture with no outcome is the one thing
 * here that genuinely is absent rather than secondary.
 */
export function V2Outcome({ status, label }: { status: string; label: string }) {
  const glyph = status === "won" ? "✓" : status === "lost" ? "✗" : "·";
  const tone =
    status === "lost"
      ? "border-[var(--hero-accent)] text-[var(--hero-accent)]"
      : status === "won"
        ? "border-[var(--hero-ink)] text-[var(--hero-ink)]"
        : "border-[var(--hero-line)] text-[var(--hero-ink-2)]";

  return (
    <span
      className={`rw-m inline-flex items-center gap-1.5 border px-2 py-1 font-bold tracking-[0.1em] ${tone}`}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </span>
  );
}
