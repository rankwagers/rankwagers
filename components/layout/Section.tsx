import type { ElementType, ReactNode } from "react";

/* ============================================================================
   THE SECTION SHELL
   ----------------------------------------------------------------------------
   One primitive carrying the three things that were being decided per-section:
   the measure, the vertical rhythm, and the ground.

   Sections converted individually each chose their own spacing, so the page had
   no rhythm BETWEEN sections however correct each one was on its own. The fix
   is not tidier values; it is that the values stop being a per-section decision.

   MEASURE   mx-auto max-w-[1240px] px-5 lg:px-8 — identical everywhere. A
             section that sets its own width breaks the column the reader is
             tracking down the page.
   RHYTHM    quiet py-16 lg:py-24 · heavy py-24 lg:py-36. The DIFFERENCE is what
             paces the page: a heavy section reads as a chapter, a quiet one as
             a continuation. Alternating them arbitrarily would waste the signal.
   GROUND    canvas → surface → ink, as punctuation. `ink` inverts the page and
             is used RARELY — one inverted band reads as emphasis, three read as
             a theme.

   V3 reconciliation: the grounds now speak the Bible V3 tokens (--bg /
   --surface / --text) instead of the retired hero token set, and the entrance
   wrapper is gone — Bible V3's motion law names four movements, and a section
   entrance is not one of them. Children render directly; the shell contributes
   no motion and no CLS.
   ========================================================================== */

export type SectionGround = "canvas" | "surface" | "ink";
export type SectionRhythm = "quiet" | "heavy" | "masthead";

export const GROUND: Record<SectionGround, string> = {
  canvas: "bg-[var(--bg)] text-[var(--text)]",
  surface: "bg-[var(--surface)] text-[var(--text)]",
  // The inverted band. Text colour is set here rather than left to inheritance so a section
  // cannot half-invert if a child forgets.
  ink: "bg-[var(--text)] text-[var(--bg)]",
};

export const RHYTHM: Record<SectionRhythm, string> = {
  quiet: "py-16 lg:py-24",
  heavy: "py-24 lg:py-36",
  /*
   * THE MASTHEAD — no top rhythm at all.
   *
   * The hero opens with the edition line, and a publication's edition line sits directly under its
   * header. `heavy` put 96–144px of ground above it, which reads as the page starting late rather
   * than as a chapter opening.
   *
   * It is still Section that owns the value, which is the point of this table: the hero states no
   * `pt-*` of its own, so there is exactly one owner of the space above the first line. Two owners
   * is what produced the dead air this rhythm scale was introduced to end.
   */
  masthead: "pt-0 pb-16 lg:pb-24",
};

/** The shared measure. Exported so a full-bleed section can still align its inner column. */
export const MEASURE = "mx-auto w-full max-w-[1240px] px-5 lg:px-8";

export function Section({
  children,
  id,
  ground = "canvas",
  rhythm = "quiet",
  bordered = false,
  labelledBy,
  className = "",
  as: Tag = "section",
  index = 0,
  analyticsSection,
}: {
  children: ReactNode;
  id?: string;
  ground?: SectionGround;
  rhythm?: SectionRhythm;
  /** Hairline above the section. Omit when the ground already changes — one or the other. */
  bordered?: boolean;
  labelledBy?: string;
  className?: string;
  as?: ElementType;
  /** Kept for call-site compatibility; the V3 shell renders children directly, no entrance. */
  reveal?: boolean;
  index?: number;
  /** Preserved verbatim — the analytics surface keys off this attribute. */
  analyticsSection?: string;
}) {
  void index;
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      data-analytics-section={analyticsSection}
      className={[
        "scroll-mt-16",
        GROUND[ground],
        bordered ? "border-t border-[var(--line)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={RHYTHM[rhythm]}>
        <div className={MEASURE}>{children}</div>
      </div>
    </Tag>
  );
}
