import assert from "node:assert/strict";
import test from "node:test";

/**
 * LOCALE SWITCHER V3 (Bible V3, chrome). The header's locale control is a
 * compact "EN ▾" pill — a real <button> opening a listbox — not the v2
 * native <select>. Same path-swap/cookie behavior as the old switcher; v3
 * skin, keyboard accessible.
 */

/* Classic-runtime setup per v3Design/mobilePass: React global first. */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } =
  require("react-dom/server") as typeof import("react-dom/server");
const { LocaleSwitcherV3 } =
  require("../components/v3/chrome/LocaleSwitcherV3") as typeof import("../components/v3/chrome/LocaleSwitcherV3");

test("the v3 locale switcher is a pill button, not a native select", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LocaleSwitcherV3, { current: "en" })
  );

  // The trigger is a real <button> declaring the listbox it opens.
  assert.match(markup, /<button[^>]*aria-haspopup="listbox"/, "trigger carries aria-haspopup");
  assert.match(markup, /<button[^>]*aria-expanded="false"/, "closed by default");
  assert.match(markup, /<button[^>]*type="button"/, "a real button, no form submit");

  // It shows the current locale uppercased with the text caret.
  assert.match(markup, />EN</, "the current locale code, uppercased");
  assert.match(markup, /▾/, "the caret is a text glyph (icon law: no stray SVG)");

  // Zero native <select> styling leak — the v2 control is gone from the v3 chrome.
  assert.equal(/<select/.test(markup), false, "no native <select> renders");
  assert.equal(/<option/.test(markup), false, "no native <option> renders");
});
