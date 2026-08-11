import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE COMMERCIAL CONVERSION — Phase B probes (acca family + the slip-complete
 * operator choice) and the kickoff-freeze projection both phases share.
 *
 *   · publication odds are FROZEN at kickoff: a post-kickoff observation can
 *     never surface as a publication price; an invalid kickoff freezes
 *     everything out (fail closed).
 *   · the decision point orders availability-first then verified-first, gates
 *     Continue on availability, and links the CANONICAL operator page.
 *   · the acca surfaces carry no legacy commercial classes; every ac key is
 *     translated in all 29 non-EN locale sets.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { freezeAtKickoff } =
  require("../lib/odds-history/publication") as typeof import("../lib/odds-history/publication");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { OddsHistoryRecord } from "../lib/odds-history/types";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const rec = (over: Partial<OddsHistoryRecord>): OddsHistoryRecord => ({
  fixtureId: 101,
  operatorId: 8,
  operatorName: "Bet365",
  market: "over25",
  line: "2.5",
  odd: 1.9,
  timestamp: "2026-08-10T10:00:00Z",
  ...over,
});

const KICKOFF = "2026-08-10T17:00:00Z";

/* ── the kickoff freeze ─────────────────────────────────────────────────── */

test("a post-kickoff observation is never a publication price", () => {
  const prices = freezeAtKickoff(
    [
      rec({ timestamp: "2026-08-10T16:59:59Z", odd: 1.85 }),
      rec({ timestamp: "2026-08-10T17:00:00Z", odd: 2.4 }),
      rec({ timestamp: "2026-08-10T18:00:00Z", odd: 3.1 }),
    ],
    KICKOFF
  );
  assert.equal(prices.length, 1);
  assert.equal(prices[0].decimal, 1.85, "only the pre-kickoff observation survives");
  assert.equal(prices[0].observedAt, "2026-08-10T16:59:59Z");
});

test("the latest pre-kickoff observation wins per operator and market", () => {
  const prices = freezeAtKickoff(
    [
      rec({ timestamp: "2026-08-10T08:00:00Z", odd: 1.7 }),
      rec({ timestamp: "2026-08-10T12:00:00Z", odd: 1.95 }),
      rec({ operatorId: 11, operatorName: "Unibet", timestamp: "2026-08-10T11:00:00Z", odd: 1.8 }),
      rec({ market: "over15", line: "1.5", timestamp: "2026-08-10T13:00:00Z", odd: 1.3 }),
    ],
    KICKOFF
  );
  assert.equal(prices.length, 3, "one price per (operator, market)");
  const o25 = prices.filter((price) => price.market === "over25");
  assert.deepEqual(
    o25.map((price) => [price.operatorId, price.decimal]),
    [
      [8, 1.95],
      [11, 1.8],
    ],
    "latest observation per operator, best price first"
  );
});

test("an invalid kickoff freezes everything out — fail closed, never fail open", () => {
  const records = [rec({})];
  assert.deepEqual(freezeAtKickoff(records, null), []);
  assert.deepEqual(freezeAtKickoff(records, undefined), []);
  assert.deepEqual(freezeAtKickoff(records, "16:15"), [], "a wall-clock string is not a kickoff");
});

test("a degenerate odd never becomes a publication price", () => {
  assert.deepEqual(freezeAtKickoff([rec({ odd: 1 }), rec({ odd: 0.5 })], KICKOFF), []);
});

/* ── the slip-complete decision point ───────────────────────────────────── */

test("the offer builder encodes the governing laws in source", () => {
  const src = SRC("lib/acca/operators.server.ts");
  assert.match(
    src,
    /Number\(b\.available\) - Number\(a\.available\) \|\|\s*Number\(b\.verified\) - Number\(a\.verified\)/,
    "availability first, verified second"
  );
  assert.match(src, /signedHref: offer\.available \? signedHref : null/, "no Continue without availability");
  assert.match(src, /\/operators\/\$\{offer\.brand\.slug\}/, "the detail link is canonical");
  assert.equal(src.includes("/reviews/"), false, "the retired reviews route is not linked");
  assert.match(src, /publicationOddsForFixture/, "observed odds come from the frozen projection");
});

test("the decision-point UI gates Continue and shows observed prices only when present", () => {
  const src = SRC("components/acca/AccaOperators.tsx");
  assert.match(src, /op\.available && op\.signedHref \?/, "Continue renders only when available+signed");
  assert.match(src, /op\.observedOdds\.length > 0 \?/, "no observation, no figures");
  assert.match(src, /rel="nofollow sponsored noopener"/, "visibly commercial");
  assert.ok(src.includes("p.fxOperatorsNote"), "the separation note renders");
  assert.equal(/>—</.test(src), false, "no dash renders as data");
});

test("the API passes each selection's kickoff through to the freeze", () => {
  const src = SRC("app/api/acca/operators/route.ts");
  assert.match(src, /kickoffAt: typeof s\.kickoffAt === "string" \? s\.kickoffAt : null/);
  assert.match(src, /await buildAccaOperatorOffers/);
});

/* ── shells + kill list ─────────────────────────────────────────────────── */

test("the acca page shells stand on the form-guide ground with dictionary strings", () => {
  for (const [file, keys] of [
    ["app/[locale]/acca/page.tsx", ["acStudioEyebrow", "acStudioTitle", "acStudioLede"]],
    ["app/[locale]/acca/builder/page.tsx", ["acBuilderTitle", "acBuilderLede"]],
  ] as const) {
    const src = SRC(file);
    assert.match(src, /rw-hero/, `${file} stands on the form-guide ground`);
    for (const key of keys) {
      assert.ok(src.includes(`p.${key}`), `${file} wires ${key}`);
    }
  }
});

test("the legacy commercial classes are gone from the acca trees", () => {
  const files = [
    "components/acca/AccaChrome.tsx",
    "components/acca/AccaPanelBody.tsx",
    "components/acca/AccaOperators.tsx",
    "components/acca/AccaStudioView.tsx",
    "components/acca/AddToAccaButton.tsx",
    "components/acca-builder/AccaBuilderView.tsx",
    "components/acca-publication/PublicAccaDetailView.tsx",
    "components/acca-publication/PublicAccaIndexView.tsx",
    "components/acca-publication/PublicAccaFilters.tsx",
    "components/acca-publication/PublicAccaCard.tsx",
    "components/acca-publication/PublicAccaPagination.tsx",
  ];
  for (const file of files) {
    const src = SRC(file);
    for (const marker of ["text-brand", "btn-primary", "btn-ghost", "font-display", "text-muted-foreground", "StarRating"]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

/* ── dictionary ─────────────────────────────────────────────────────────── */

const AC_KEYS = Object.keys(predictionsEn).filter((k) => /^ac[A-Z]/.test(k));

test("the ac key set is the full 14", () => {
  assert.equal(AC_KEYS.length, 14, `expected 14 ac keys, found ${AC_KEYS.length}`);
});

test("every ac key exists translated in every locale set", () => {
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of AC_KEYS) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
      assert.ok(dict[key].length > 0, `${locale}.${key} empty`);
    }
    if (locale !== "en") {
      for (const key of ["acStudioLede", "acOperatorsNote"]) {
        assert.notEqual(
          dict[key],
          (predictionsEn as unknown as Record<string, string>)[key],
          `${locale}.${key} is the EN string — fallback debt`
        );
      }
    }
  }
});

test("no gambling instruction enters through an acca translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i, /risk[- ]free/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of AC_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});
