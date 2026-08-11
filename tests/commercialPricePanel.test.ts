import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE COMMERCIAL CONVERSION — Phase C probes: the price panel, its data
 * builder, and the post-L2 bridge. (The kickoff freeze itself is probed in
 * commercialAcca.test.ts, where the projection was born.)
 *
 *   · RECONCILIATION pinned: the odds-at-publication log IS the existing
 *     odds_history infrastructure plus the freeze projection — no parallel
 *     store exists.
 *   · the affordance renders only when something was observed; the panel data
 *     builder orders availability→verified→price and gates Continue on
 *     availability; the panel opens inline (data as a door), routes only via
 *     a visible Continue; archive and search stay commercial-free.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { PricePanel } =
  require("../components/odds/PricePanel") as typeof import("../components/odds/PricePanel");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { PricePanelRow } from "../lib/operators/pricePanel.server";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const row = (over: Partial<PricePanelRow>): PricePanelRow => ({
  operatorSlug: "one",
  operatorName: "One",
  verified: true,
  available: true,
  decimal: 1.9,
  observedAt: "2026-08-10T12:00:00Z",
  continueHref: "/go/one?placement=price_panel",
  ...over,
});

/* ── the reconciliation is stated, not re-invented ──────────────────────── */

test("the odds-at-publication log is a projection of odds_history — no parallel store", () => {
  const projection = SRC("lib/odds-history/publication.ts");
  assert.match(projection, /RECONCILIATION/, "the decision is recorded at the projection");
  assert.match(projection, /queryOddsHistory/, "it reads the existing store");
  assert.equal(projection.includes("CREATE TABLE"), false, "no new schema");
  assert.equal(
    require("node:fs").existsSync(path.join(root, "db/migrations")) &&
      require("node:fs")
        .readdirSync(path.join(root, "db/migrations"))
        .filter((f: string) => /odds/.test(f)).length,
    1,
    "exactly the one existing odds migration — nothing parallel was added"
  );
});

/* ── the panel ──────────────────────────────────────────────────────────── */

test("the chip is a door: closed by default, opens inline, routes only via Continue", () => {
  const html = renderToStaticMarkup(
    React.createElement(PricePanel, {
      rows: [row({}), row({ operatorSlug: "two", operatorName: "Two", decimal: 1.85, available: false, continueHref: null })],
      locale: "en",
      p: predictionsEn,
    })
  );
  assert.match(html, /aria-expanded="false"/, "closed by default");
  assert.ok(html.includes("1.90"), "the chip carries the best observed decimal");
  // Closed panel renders NO links at all — the click must never be a surprise navigation.
  assert.equal(/<a /.test(html), false, "no link renders until the reader opens the panel");
});

test("the panel data builder encodes the ordering and the Continue gate in source", () => {
  const src = SRC("lib/operators/pricePanel.server.ts");
  assert.match(
    src,
    /Number\(b\.available\) - Number\(a\.available\) \|\|\s*Number\(b\.verified\) - Number\(a\.verified\) \|\|\s*b\.decimal - a\.decimal/,
    "availability → verified → price"
  );
  assert.match(
    src,
    /availability\.available && operator\.affiliateEnabled\s*\?\s*buildGoPath/,
    "Continue is gated on availability"
  );
  assert.match(src, /placement: "price_panel"/, "the placement is emitted on every Continue");
  assert.match(src, /publicationOddsForFixture/, "prices come only from the frozen projection");
});

test("the affordance cannot render for an unobserved market", () => {
  // The integrations guard on rows/markets presence; the panel itself refuses empties.
  const html = renderToStaticMarkup(
    React.createElement(PricePanel, { rows: [], locale: "en", p: predictionsEn })
  );
  assert.equal(html, "", "no rows, no affordance, no panel");
  for (const [file, guard] of [
    ["components/fixtures/FixtureSignalLevels.tsx", "rowsFor(signal.market)"],
    ["components/markets/MarketDetailView.tsx", "pricesByFixture?.[fixture.matchId]?.length"],
  ] as const) {
    assert.ok(SRC(file).includes(guard), `${file} guards the affordance on observation presence`);
  }
});

test("the post-L2 bridge is one quiet anchor to L5 — never a redirect", () => {
  const src = SRC("components/fixtures/FixtureSignalLevels.tsx");
  assert.match(src, /href="#fx-operators-heading"/, "anchors to the operators level");
  assert.ok(src.includes("p.fxBridgeOperators"), "dictionary-born");
  assert.match(src, /data-placement="post_l2_bridge"/, "its placement is named");
  const target = SRC("components/fixtures/FixtureOperatorsSection.tsx");
  assert.match(target, /id="fx-operators-heading"/, "the anchor target exists");
});

test("archive and search keep ZERO commercial presence", () => {
  for (const file of [
    "app/[locale]/archive/page.tsx",
    "app/[locale]/archive/[date]/page.tsx",
    "app/[locale]/search/page.tsx",
  ]) {
    const src = SRC(file);
    for (const marker of ["PricePanel", "buildPricePanelData", "OperatorEvidenceCardList", "sponsored"]) {
      assert.equal(src.includes(marker), false, `${file} grew commercial presence (${marker})`);
    }
  }
});

/* ── dictionary ─────────────────────────────────────────────────────────── */

test("the pp/bridge keys exist translated in every locale set", () => {
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of ["ppTitle", "ppAria", "fxBridgeOperators"]) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
      assert.ok(dict[key].length > 0, `${locale}.${key} empty`);
    }
    if (locale !== "en") {
      assert.notEqual(dict.ppTitle, predictionsEn.ppTitle, `${locale}.ppTitle is EN fallback`);
    }
  }
});
