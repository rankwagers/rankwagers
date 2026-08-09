import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { GROUND, MEASURE, RHYTHM } from "../components/layout/Section";

/**
 * The shell: measure, rhythm, ground, and the converted chrome.
 *
 * SCOPE OF THIS VERIFICATION. `SiteTopChrome` and `Footer` are rendered in exactly one place —
 * `app/[locale]/layout.tsx` — so all 34 locale routes receive the identical component tree and
 * differ only in `children`. Asserting the chrome's own output therefore covers every route
 * structurally. It does NOT cover how the converted chrome looks against each page's content;
 * that needs eyes on a screen, and is stated as unverified rather than implied.
 */

const root = process.cwd();
/** Source with comments removed — a comment explaining a colour is not a rendered colour. */
const src = (rel: string) =>
  readFileSync(path.join(root, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/* -- the measure and the rhythm are decided once ---------------------------- */

test("the measure is identical for every section", () => {
  assert.equal(MEASURE, "mx-auto w-full max-w-[1240px] px-5 lg:px-8");
});

test("rhythm is two steps, and the difference is what paces the page", () => {
  assert.equal(RHYTHM.quiet, "py-16 lg:py-24");
  assert.equal(RHYTHM.heavy, "py-24 lg:py-36");
  assert.notEqual(RHYTHM.quiet, RHYTHM.heavy, "the two steps must differ or they pace nothing");
});

test("grounds are canvas, surface and ink, and ink inverts its text", () => {
  assert.match(GROUND.canvas, /--hero-canvas/);
  assert.match(GROUND.surface, /--hero-surface/);
  assert.match(GROUND.ink, /--hero-ink/);
  assert.match(GROUND.ink, /text-white/, "an inverted ground must set its own text colour");
  // Every ground states a text colour rather than relying on inheritance.
  for (const g of [GROUND.canvas, GROUND.surface, GROUND.ink]) {
    assert.match(g, /text-/);
  }
});

test("no section sets its own measure, rhythm or ground", () => {
  const home = src("components/bible/RankWagersHome.tsx");
  // Every homepage section goes through the primitive.
  assert.equal(
    (home.match(/<section\b/g) ?? []).length,
    0,
    "a raw <section> is a section deciding its own frame"
  );
  assert.ok((home.match(/<Section\b/g) ?? []).length >= 6, "all six sections use the primitive");
  // The old hand-made inter-section spacer is gone; Section owns the rhythm.
  assert.equal(home.includes("<SectionPause />"), false);
});

test("the hero scope is declared once, on the page", () => {
  const home = src("components/bible/RankWagersHome.tsx");
  assert.equal((home.match(/className="rw-hero/g) ?? []).length, 1);
});

/* -- the converted chrome --------------------------------------------------- */

test("the shared header is a masthead, not a sticky app bar", () => {
  const chrome = src("components/SiteTopChrome.tsx");
  /*
   * v2 turns the header into a MASTHEAD: it carries the edition line and closes on the thick rule,
   * and it scrolls away. A masthead that follows the reader down the page is a toolbar wearing
   * one, so the sticky positioning and its backdrop blur are gone rather than restyled.
   */
  assert.match(chrome, /rw-hero w-full bg-\[var\(--hero-canvas\)\]/);
  assert.equal(/sticky|backdrop-blur/.test(chrome), false, "the masthead does not follow the reader");
  // The cream ground it replaced must be gone, not merely overridden.
  assert.equal(chrome.includes("canvas-secondary"), false);

  const header = src("components/Header.tsx");
  assert.match(header, /max-w-\[1240px\] px-5 pt-6 lg:px-8/, "the shared measure is unchanged");
  assert.equal(header.includes("text-brand"), false, "the green brand colour is gone");
  assert.equal(header.includes("canvas-secondary"), false);
});

test("the masthead states the edition line and closes on the thick rule", () => {
  const header = src("components/Header.tsx");
  // One mono line, right-aligned: retrieved · edition · 18+.
  assert.match(header, /\{meta\}/, "the masthead prints the line it is given");
  assert.match(header, /ml-auto/, "held to the right edge");
  assert.match(header, /font-hero-mono/, "in the mono face");
  // 2px ink over a half-ink hairline, 2px apart — the map's heaviest opening.
  assert.match(header, /h-\[2px\] w-full bg-\[var\(--hero-ink\)\]/);
  assert.match(header, /mt-\[2px\] h-px w-full bg-\[var\(--hero-ink\)\] opacity-50/);
});

test("search and the language select are not in the masthead", () => {
  /*
   * A product decision, and this is what makes it checkable. Neither is REMOVED — both live in
   * the menu sheet, which is why the sheet's button is visible at every width. What must not
   * happen is one of them creeping back into the bar and quietly re-widening it.
   */
  const header = src("components/Header.tsx");
  assert.equal(/GlobalSearch/.test(header), false, "search is not in the masthead");
  assert.equal(/LanguageSwitcher/.test(header), false, "nor is the language select");

  const sheet = src("components/MobileNav.tsx");
  assert.match(sheet, /GlobalSearch/, "search is in the sheet");
  assert.match(sheet, /LanguageSwitcher/, "and so is the language select");
});

test("the footer is the page's one inverted ground", () => {
  const footer = src("components/Footer.tsx");
  assert.match(footer, /bg-\[var\(--hero-ink\)\] text-white/);
  assert.match(footer, /max-w-\[1240px\] px-5 .*lg:px-8/);
  assert.equal(footer.includes("canvas-secondary"), false);
  // Contrast pairs are chosen against #0b0c0e, not inherited from the light surface.
  assert.equal(footer.includes("--ink-secondary"), false);
});

test("section grounds alternate strictly down the page", () => {
  /*
   * The shipped failure this pins: Live Signals sat on canvas directly after the ranked section
   * (also canvas) — two grey neighbours, alternation dead. The walk reads every <Section> in
   * source order (the page is one linear JSX run, so source order IS page order), resolves each
   * ground including the primitive's `canvas` default, and rejects any adjacent pair sharing a
   * ground. The footer's ink is the terminal band and exempt from the alternation pattern; it is
   * still appended as the final neighbour, which the adjacency rule covers for free.
   */
  const home = src("components/bible/RankWagersHome.tsx");
  const sections = [...home.matchAll(/<Section\b([\s\S]*?)>/g)];
  assert.ok(sections.length >= 6, "the walk must actually find the section run");
  const grounds = sections.map(
    ([, props]) => props.match(/ground="(\w+)"/)?.[1] ?? "canvas"
  );
  for (const g of grounds) {
    assert.ok(["canvas", "surface", "ink"].includes(g), `unknown ground "${g}"`);
  }
  grounds.push("ink"); // the footer, the page's terminal band
  grounds.forEach((g, i) => {
    if (i === 0) return;
    assert.notEqual(
      g,
      grounds[i - 1],
      `sections ${i - 1} and ${i} share the ground "${g}" — the alternation is broken`
    );
  });
});

test("ink stays rare: exactly one inverted ground ships in this pass", () => {
  const home = src("components/bible/RankWagersHome.tsx");
  assert.equal(
    home.includes('ground="ink"'),
    false,
    "no homepage section inverts yet — their interiors are light-ground"
  );
  assert.match(src("components/Footer.tsx"), /bg-\[var\(--hero-ink\)\]/);
});

/* -- the refusals still hold ------------------------------------------------ */

test("the prototype's theme block, font import and failing ink stay out", () => {
  const css = src("app/globals.css");
  assert.equal(/@theme\b/.test(css), false, "no @theme block");
  assert.equal(/fonts\.googleapis\.com/.test(css), false, "no runtime Google Fonts import");
  /*
   * Rebrand v2 retires the third ink weight: `--hero-ink-3` is now an ALIAS of ink-2 (#55524e),
   * kept only so an unconverted call site inside the scope degrades to the darker value rather
   * than to an undefined variable. Contrast moved the right way — 7.0:1 on the ground, against
   * v1's 4.70:1 — so the AA guarantee this test protects is stronger, not weaker.
   */
  assert.match(css, /--hero-ink-3: #55524e/);
  assert.match(css, /--hero-ink-2: #55524e/);
});

/* -- zero CLS, and the opt-out ---------------------------------------------- */

test("the shell animates only opacity, transform and filter", () => {
  const css = src("app/globals.css");
  const scope = css.slice(css.indexOf("HERO VISUAL LANGUAGE"));
  // A box property in the reveal path would move layout and cost CLS.
  const revealRule = scope.slice(scope.indexOf(".rw-hero .reveal"), scope.indexOf(".is-in"));
  for (const boxProp of ["height", "width", "margin", "padding", "top:", "left:"]) {
    assert.equal(
      revealRule.includes(boxProp),
      false,
      `the reveal transitions ${boxProp}, which moves layout`
    );
  }
});

test("reduced motion removes the shell's motion entirely", () => {
  const css = src("app/globals.css");
  const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce, /\.rw-hero \.reveal/);
  assert.match(reduce, /transition: none/);
  assert.match(reduce, /--travel: 0px/);
  assert.match(reduce, /--focus: 0px/);
  assert.match(reduce, /transform: none/);
});

/* -- rebrand v2: the token layer --------------------------------------------- */

test("v2 palette replaces v1 inside the scope, and the scope mechanism is kept", () => {
  const css = src("app/globals.css");
  assert.match(css, /--hero-ink: #201e1d/);
  assert.match(css, /--hero-ink-2: #55524e/);
  assert.match(css, /--hero-canvas: #f7f7f6/);
  assert.match(css, /--hero-surface: #ffffff/);
  assert.match(css, /--hero-accent: #ec3013/);
  assert.match(css, /--hero-live: #ff6a4d/);
  // v1's blue accent and near-black must not survive.
  assert.equal(/--hero-accent: #2a55e0/.test(css), false);
  assert.equal(/--hero-ink: #0b0c0e/.test(css), false);
  // Still scoped — an unconverted surface is untouched, which is what makes this reversible.
  assert.match(css, /\.rw-hero \{/);
});

test("radius is 0 everywhere in scope", () => {
  const css = src("app/globals.css");
  const scope = css.slice(css.indexOf(".rw-hero {"), css.indexOf("color: var(--hero-ink);"));
  assert.match(scope, /--radius-sm: 0px/);
  assert.match(scope, /--radius-md: 0px/);
  assert.match(scope, /--radius-lg: 0px/);
});

test("the rules ladder is 0.5 / 1 / 1.5 / 2 / 5, with nothing between", () => {
  const css = src("app/globals.css");
  assert.match(css, /--rule-hair: 0\.5px/);
  assert.match(css, /--rule-1: 1px/);
  assert.match(css, /--rule-2: 1\.5px/);
  assert.match(css, /--rule-3: 2px/);
  assert.match(css, /--rule-heavy: 5px/);
});

test("the heading face is wired through next/font, never a runtime import", () => {
  const fonts = src("lib/fonts.ts");
  assert.match(fonts, /Archivo/);
  assert.match(fonts, /weight: \["800"\]/, "one weight — the rest would be dead bytes");
  assert.match(fonts, /variable: "--font-rw-heading"/);
  // Declared at the document root so next/font can inline and preload it.
  assert.match(src("app/layout.tsx"), /archivo\.variable/);
  // And never fetched at runtime.
  assert.equal(/fonts\.googleapis\.com/.test(src("app/globals.css")), false);
});

test("v2 type primitives exist at the map's ladder", () => {
  const css = src("app/globals.css");
  /*
   * The numeral clamps below the map's widths (doc §Below sm): the ceiling is still the
   * ladder's 148, so the desktop step is unchanged; the floor keeps the numeral narrower than
   * a 360px screen. A bare 148px here would be the numeral overflowing a phone again.
   */
  assert.match(css, /\.rw-hero \.rw-lead-numeral \{[\s\S]*?font-size: clamp\(72px, 22vw, 148px\)/);
  assert.match(css, /\.rw-hero \.rw-m \{[\s\S]*?font-size: 10\.5px/);
  assert.match(css, /\.rw-hero \.rw-h \{[\s\S]*?font-weight: 800/);
});

test("the nav is mono, and the active destination carries a 2px rule", () => {
  const header = src("components/Header.tsx");
  const css = src("app/globals.css");

  // Mono, uppercase, letterspaced — the map's nav face.
  assert.match(header, /rw-nav/, "the nav items take the mono nav primitive");
  assert.match(css, /\.rw-hero \.rw-nav \{[^}]*font-hero-mono/s, "which is the mono face");
  assert.match(css, /\.rw-hero \.rw-nav \{[^}]*text-transform: uppercase/s);
  assert.match(css, /\.rw-hero \.rw-nav \{[^}]*letter-spacing: 0\.1em/s);

  /*
   * The rule is an absolutely positioned 2px bar scaled from the left. It costs no layout in
   * either state, so the row cannot reflow when the active destination changes — the same zero-CLS
   * guarantee the previous always-present border gave, by a different mechanism.
   */
  assert.match(header, /h-\[2px\] origin-left bg-\[var\(--hero-ink\)\]/);
  assert.match(header, /active \? "scale-x-100" : "scale-x-0/);
  assert.equal(/bg-accent/.test(header), false, "no filled chip survives");
});

test("the accent budget is stated and the live colour is reserved", () => {
  const css = src("app/globals.css");
  const doc = src("docs/design/motion-language-v2.md");
  assert.match(doc, /at most two uses per page/i);
  assert.match(doc, /live dot and the minute/i);
  // The live colour is declared but takes no consumers outside the live surface yet.
  assert.match(css, /--hero-live/);
});

test("the v2 rules doc records what was refused", () => {
  const doc = src("docs/design/motion-language-v2.md");
  assert.match(doc, /figures are mock/i);
  assert.match(doc, /No runtime `@import`/i);
  assert.match(doc, /does not license a count-up/i);
  assert.match(doc, /Never two columns/i);
});
