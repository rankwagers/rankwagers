import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE MOBILE POLISH PASS — six surgical items, each pinned.
 *
 *   1  country short names in stacked rows (display layer only)
 *   2  hover gated behind (hover: hover) — no sticky filled buttons after tap
 *   3  the trailing arrow can never wrap alone
 *   4  the masthead/main boundary cannot expose the wrapper's cream
 *   5  touch :active fires the ray + wash — 0ms in, 150ms out, never sticky
 *   6  mobile scroll entrances: rise + fade, ≤300ms, stagger bounded, reduced-motion clean
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { V2LeagueCell, V2ArrowLabel } =
  require("../components/homepage/v2Chrome") as typeof import("../components/homepage/v2Chrome");

const root = process.cwd();
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const code = (rel: string) =>
  src(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ================================================================== *
 * 1 — country short names
 * ================================================================== */

test("long country names take their short form below sm, and never an ellipsis", () => {
  const html = renderToStaticMarkup(
    React.createElement(V2LeagueCell, { country: "us", league: "MLS Next Pro" })
  );
  // The mobile span carries the short form; the desktop span keeps the full name.
  assert.match(html, />USA</, "the mobile span prints the short form");
  assert.match(html, />United States</, "the desktop span keeps the platform's full name");
  assert.match(html, /sm:hidden/, "one is mobile-only");
  assert.match(html, /hidden[^"]*sm:block/, "the other desktop-only");

  // An unmapped name falls back to a wrap, not an ellipsis: the mobile span never truncates.
  const cell = code("components/homepage/v2Chrome.tsx");
  const mobileSpan = /<span className="rw-m font-bold text-\[var\(--hero-ink\)\] sm:hidden">/;
  assert.match(cell, mobileSpan, "the mobile country span exists");
  assert.doesNotMatch(
    /sm:hidden[^>]*>/.exec(cell)?.[0] ?? "",
    /truncate/,
    "the mobile country span never ellipsizes — wrap is the fallback"
  );
  assert.match(cell, /flex-wrap/, "and the cell permits the two-line wrap");

  // Display layer only: the resolver and its data are untouched.
  const resolver = src("lib/countryDisplay.ts");
  assert.equal(resolver.includes("SHORT_COUNTRY"), false, "no short map in the data layer");
  assert.equal(resolver.includes('"USA"'), false, "the resolver still speaks full names");
});

/* ================================================================== *
 * 2 — hover is a pointer state, gated as one
 * ================================================================== */

test("tailwind hover variants compile only for hover-capable pointers", () => {
  const config = src("tailwind.config.ts");
  assert.match(config, /hoverOnlyWhenSupported: true/, "the future flag gates every hover: variant");
});

/* ================================================================== *
 * 3 — the arrow never wraps alone
 * ================================================================== */

test("V2ArrowLabel binds the arrow to the last word with white-space: nowrap", () => {
  const html = renderToStaticMarkup(React.createElement(V2ArrowLabel, { text: "Open accumulators" }));
  assert.match(
    html,
    /<span class="whitespace-nowrap">accumulators <span aria-hidden="true" class="rw-arrow">→<\/span><\/span>/,
    "the last word and the arrow share one unbreakable span"
  );
  assert.match(html, /^Open /, "the head of the label still wraps freely");

  // A one-word label is entirely unbreakable.
  const single = renderToStaticMarkup(React.createElement(V2ArrowLabel, { text: "Continue" }));
  assert.match(single, /<span class="whitespace-nowrap">Continue /);
});

test("every inline label+arrow site on the page goes through the orphan guard", () => {
  for (const rel of [
    "components/homepage/hero/HeroStage.tsx",
    "components/homepage/HomepageAccaEntry.tsx",
    "components/bible/RankWagersHome.tsx",
    "components/bible/BibleOperatorStrip.tsx",
    "components/predictions/LiveFeedPanel.tsx",
  ]) {
    const s = code(rel);
    assert.match(s, /V2ArrowLabel/, `${rel} binds its arrows`);
    // No inline site composes a bare arrow beside a label any more. (V2Button and the lead's
    // close are inline-flex — a flex row cannot wrap between its items — and keep their own.)
    assert.doesNotMatch(
      s,
      /\{[a-zA-Z.]+\}\s+<span aria-hidden className="rw-arrow">/,
      `${rel} still composes a wrappable label+arrow pair`
    );
  }
});

/* ================================================================== *
 * 4 — the masthead boundary
 * ================================================================== */

test("the masthead's ground bleeds one net-zero pixel under main, closing the seam", () => {
  const chrome = code("components/SiteTopChrome.tsx");
  assert.match(
    chrome,
    /rw-hero w-full bg-\[var\(--hero-canvas\)\] pb-px -mb-px/,
    "the bleed pairs pb-px with -mb-px so the grounds overlap and net height is zero"
  );
});

/* ================================================================== *
 * 5 — touch active states
 * ================================================================== */

test("under (hover: none) the press fires the ray + wash — instant in, 150ms out, never sticky", () => {
  const css = src("app/globals.css");
  const touch = /@media \(hover: none\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(touch, "the touch block exists");
  const t = touch[1];

  // The same language as hover: the wash at the pinned 3% and the rail drawn to full.
  assert.match(t, /\.rw-hero \.rw-row:active \{[^}]*rgb\(var\(--hero-ink-rgb\) \/ 0\.03\)/);
  assert.match(t, /\.rw-hero \.rw-row:active::before \{[^}]*scaleY\(1\)/);
  assert.match(t, /\.rw-hero \.rw-row:active \.rw-cell-arrow \{[^}]*var\(--hero-ink\)/);
  assert.match(t, /\.rw-hero \.rw-lead:active/, "the lead presses too");
  assert.match(t, /\[data-live-signal-id\]:active/, "and the live desk's rows");

  // Snappy in, soft out.
  assert.match(t, /transition-duration: 150ms/, "the release settles over 150ms");
  assert.match(t, /:active \{[^}]*transition-duration: 0ms/, "the press lands instantly");

  // Hover neutralised on touch, AFTER which :active wins at equal specificity.
  assert.match(t, /\.rw-hero \.rw-row:hover \{[^}]*transparent/);
  assert.ok(
    t.indexOf(".rw-hero .rw-row:hover") < t.indexOf(".rw-hero .rw-row:active"),
    "the :active rules follow the :hover neutralisers, so the press wins during the tap"
  );
});

test("the touch call sites carry active twins beside their gated hover styles", () => {
  const lead = code("components/homepage/hero/HeroLead.tsx");
  assert.match(lead, /group-active:bg-\[var\(--hero-ink\)\]/, "the lead's close inverts on press");
  assert.match(lead, /group-active:scale-x-100/, "and its rule draws on press");

  const home = code("components/bible/RankWagersHome.tsx");
  // The island's wash lives at the CSS site (components never pre-wrap rgb() — the rail
  // convention): the article carries the class hook, the touch block composes the colour.
  assert.match(home, /rw-island group relative/, "the island carries the touch-wash hook");
  assert.match(home, /group-active:scale-x-100/, "the island's ray fires on press");

  const chrome = code("components/homepage/v2Chrome.tsx");
  assert.match(chrome, /active:bg-\[var\(--hero-ink\)\] active:text-\[var\(--hero-canvas\)\]/,
    "V2Button inverts on press");
});

/* ================================================================== *
 * 6 — mobile scroll entrances
 * ================================================================== */

test("below sm the reveal is a ≤300ms rise-and-fade with a bounded stagger", () => {
  const css = src("app/globals.css");
  const mobile = /@media \(max-width: 639\.98px\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(mobile, "the mobile reveal block exists");
  const m = mobile[1];

  assert.match(m, /\.rw-hero \.reveal,\s*\.rw-hero \.rw-reveal/, "it retunes the shared reveal");
  const dur = Number(/transition-duration: (\d+)ms/.exec(m)?.[1]);
  assert.ok(dur <= 300, `duration ${dur}ms exceeds the 300ms mobile ceiling`);
  assert.match(m, /--travel: 8px/, "a small rise");
  assert.match(m, /--focus: 0px/, "no blur on a phone GPU");
  const step = Number(/var\(--i, 0\) \* (\d+)ms/.exec(m)?.[1]);
  assert.ok(dur + step * 5 <= 500, `worst case ${dur + step * 5}ms breaches the half-second feel`);

  // The observer fires once per element and adds a class — no re-trigger, no scroll listener.
  const motion = src("components/homepage/hero/motion.ts");
  assert.match(motion, /observer\.unobserve\(entry\.target\)/, "once per element");
  assert.match(motion, /prefersReducedMotion\(\)/, "reduced motion opts out before observing");

  // The reduced-motion neutraliser still comes AFTER the mobile tuning, so it wins outright.
  assert.ok(
    css.indexOf("@media (max-width: 639.98px)") <
      css.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    "prefers-reduced-motion is declared later and neutralises the mobile reveal too"
  );
});
