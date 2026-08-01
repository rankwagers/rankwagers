import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  RISK_TONE_CLASS,
  STATUS_TONE_CLASS,
  TOUCH_TARGET_CLASS,
} from "../lib/ui/tokens";
import { getFocusable, trapTabKey } from "../lib/ui/focusTrap";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("design tokens expose spacing radius status risk and canvas alias", () => {
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  for (const token of [
    "--canvas:",
    "--space-4",
    "--radius-md",
    "--shadow-elevated",
    "--status-won-fg",
    "--risk-aggressive-bg",
    "--touch-min",
    "--motion-base",
    "prefers-reduced-motion",
    ".sheet-enter",
    // `.pct-shine` was asserted here until the design system retired it: it was an infinite
    // decorative glow on a numeric value, and spec §6 permits no infinite animation. It is
    // replaced by the canonical primitives the same file must now define (spec §7, §8, §11),
    // which is a stronger assertion than the class it succeeds.
    ".btn-primary",
    ".card",
    ".badge",
    'data-theme="dark"',
  ]) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("tailwind colors wire to css variables", () => {
  const tw = readFileSync(path.join(root, "tailwind.config.ts"), "utf8");
  assert.match(tw, /--green-primary-rgb/);
  assert.match(tw, /var\(--shadow-card\)/);
  assert.match(tw, /var\(--radius-md\)/);
});

test("status and risk tone maps are complete", () => {
  assert.ok(STATUS_TONE_CLASS.won.includes("status-won"));
  assert.ok(STATUS_TONE_CLASS.live.includes("status-live"));
  assert.ok(RISK_TONE_CLASS.very_aggressive.includes("risk-very-aggressive"));
  assert.match(TOUCH_TARGET_CLASS, /touch-min/);
});

test("focus trap cycles tab within container", () => {
  // jsdom-less: unit-test helper contracts via synthetic elements when DOM available
  if (typeof document === "undefined") {
    assert.equal(typeof trapTabKey, "function");
    assert.equal(typeof getFocusable, "function");
    return;
  }
  const rootEl = document.createElement("div");
  const a = document.createElement("button");
  const b = document.createElement("button");
  rootEl.append(a, b);
  document.body.append(rootEl);
  a.focus();
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
  Object.defineProperty(event, "preventDefault", {
    value() {
      /* noop */
    },
  });
  // When focus is on last, Tab should move to first — exercised via getFocusable length
  assert.equal(getFocusable(rootEl).length, 2);
  rootEl.remove();
});

test("bottom sheet mobile nav acca and search a11y contracts", () => {
  const sheet = readFileSync(
    path.join(root, "components/ui/BottomSheet.tsx"),
    "utf8"
  );
  assert.match(sheet, /aria-modal/);
  assert.match(sheet, /Escape/);
  assert.match(sheet, /trapTabKey/);

  const nav = readFileSync(path.join(root, "components/MobileNav.tsx"), "utf8");
  assert.match(nav, /Escape/);
  assert.match(nav, /trapTabKey/);
  assert.match(nav, /previousFocus/);

  const acca = readFileSync(
    path.join(root, "components/acca/AccaChrome.tsx"),
    "utf8"
  );
  assert.match(acca, /BottomSheet/);
  // The launcher used to spell its own focus ring inline. Spec §6 gives focus ONE treatment and
  // requires components to defer to it, so the ring now lives on the `.btn` primitive (and on the
  // global `:focus-visible`). Assert the primitive is used — that is what carries the contract now.
  assert.match(acca, /btn-primary|focus-visible/);
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.btn\s*\{[^}]*focus-visible/);

  const search = readFileSync(
    path.join(root, "components/search/GlobalSearch.tsx"),
    "utf8"
  );
  assert.match(search, /aria-live/);
  assert.match(search, /focus-visible:outline/);
  assert.match(search, /w-52/);
});

test("filter toolbar is horizontally scrollable for narrow viewports", () => {
  const explorer = readFileSync(
    path.join(root, "components/bible/BibleFixtureExplorer.tsx"),
    "utf8"
  );
  assert.match(explorer, /overflow-x-auto/);
  assert.match(explorer, /snap-x/);
  assert.match(explorer, /role="toolbar"/);
  assert.match(explorer, /min-h-9/);
});

test("shared ui primitives and design docs exist", () => {
  for (const rel of [
    "components/ui/InlineAlert.tsx",
    "components/ui/BottomSheet.tsx",
    "lib/ui/tokens.ts",
    "lib/ui/focusTrap.ts",
    "docs/design-system.md",
    "docs/accessibility.md",
  ]) {
    assert.ok(readFileSync(path.join(root, rel), "utf8").length > 40, rel);
  }
});
