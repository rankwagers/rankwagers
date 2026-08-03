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

test("the shared header carries the prototype shell", () => {
  const chrome = src("components/SiteTopChrome.tsx");
  assert.match(chrome, /rw-hero sticky top-0/);
  assert.match(chrome, /border-\[var\(--hero-line\)\]\/80/);
  assert.match(chrome, /bg-\[var\(--hero-canvas\)\]\/80/);
  assert.match(chrome, /backdrop-blur-xl/);
  // The cream ground it replaced must be gone, not merely overridden.
  assert.equal(chrome.includes("canvas-secondary"), false);

  const header = src("components/Header.tsx");
  assert.match(header, /h-16 w-full max-w-\[1240px\] .*px-5 lg:px-8/);
  assert.equal(header.includes("text-brand"), false, "the green brand colour is gone");
  assert.equal(header.includes("canvas-secondary"), false);
});

test("the footer is the page's one inverted ground", () => {
  const footer = src("components/Footer.tsx");
  assert.match(footer, /bg-\[var\(--hero-ink\)\] text-white/);
  assert.match(footer, /max-w-\[1240px\] px-5 .*lg:px-8/);
  assert.equal(footer.includes("canvas-secondary"), false);
  // Contrast pairs are chosen against #0b0c0e, not inherited from the light surface.
  assert.equal(footer.includes("--ink-secondary"), false);
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
  assert.match(css, /--hero-ink-3: #6b6f78/);
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
