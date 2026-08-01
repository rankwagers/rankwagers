import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPrimaryNav } from "../lib/navigation/primaryNav";
import {
  homepageFixtureExplorerHref,
  homepageSearchResultHref,
  marketKindToFilterCode,
} from "../lib/search/homeSearchRoutes";
import { toggleSavedFixture, type SavedFixtureRecord } from "../lib/research/savedFixtures";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("best-betting-sites uses betting variant and bestBetting metadata keys", () => {
  const src = readFileSync(
    path.join(root, "app/[locale]/best-betting-sites/page.tsx"),
    "utf8"
  );
  assert.match(src, /variant=["']betting["']/);
  assert.doesNotMatch(src, /variant=["']crypto["']/);
  assert.match(src, /bestBettingTitle/);
  assert.match(src, /bestBettingDescription/);
});

test("primary nav includes bookmaker hubs and grouped research/browse", () => {
  const { groups, desktop, flat } = buildPrimaryNav("en", {
    bestBetting: "Best Betting Sites",
    bestCrypto: "Best Crypto",
    bonuses: "Bonuses",
    reviews: "Assessments",
  });
  assert.deepEqual(
    groups.map((g) => g.id),
    ["research", "bookmakers", "browse"]
  );
  assert.ok(flat.some((item) => item.href === "/en/best-betting-sites"));
  assert.ok(flat.some((item) => item.href === "/en/bonuses"));

  /*
   * This test previously required `Best Betting Sites` and `Shortlist` to hold compact-desktop
   * slots. That requirement was withdrawn, not relaxed: the compact row is bounded by a header
   * container capped at max-w-[1440px], which leaves it roughly 580px at 1280px wide, and the
   * nine entries it carried measured 920px of links. The row had no width constraint, so the
   * surplus was painted over the search input at every width the row appeared at. The budget is
   * now five, measured at 569px.
   *
   * What matters for the reader is reachability, not masthead billing, so that is what is
   * asserted here: every entry that stood down is still in `flat`, which is what feeds the
   * grouped menu — and that menu is now visible at every width (MobileNav).
   */
  assert.ok(desktop.length <= 5, `compact desktop row must stay within budget, got ${desktop.length}`);
  for (const href of ["/en/best-betting-sites", "/en/operators", "/en/markets", "/en#saved"]) {
    assert.ok(
      flat.some((item) => item.href === href),
      `${href} stood down from the compact row and must remain reachable via the grouped menu`
    );
    assert.ok(
      !desktop.some((item) => item.href === href),
      `${href} is expected to be outside the compact row budget`
    );
  }
  // The masthead keeps the surfaces that answer "should I believe this?".
  for (const label of ["Today's fixtures", "Archive", "Methodology"]) {
    assert.ok(desktop.some((item) => item.label === label), `${label} must hold a masthead slot`);
  }
  // No two entries may render the same visible label — `nav.bestBetting` is "Operators" in en,
  // which collided with the dedicated /operators entry until this route took `nav.reviews`.
  const labels = flat.map((item) => item.label);
  assert.equal(
    new Set(labels).size,
    labels.length,
    `duplicate nav labels: ${labels.filter((l, i) => labels.indexOf(l) !== i).join(", ")}`
  );
});

test("homepage deep links prefer canonical fixture routes when fixtureId is present", () => {
  assert.equal(
    homepageFixtureExplorerHref("en", { fixtureId: 42, market: "O1.5" }),
    "/en/fixtures/42?market=over15"
  );
  assert.equal(
    homepageFixtureExplorerHref("en", { market: "O2.5" }),
    "/en?market=O2.5#fixtures"
  );
  assert.equal(
    homepageSearchResultHref("de", {
      fixtureId: 9,
      label: "A vs B",
      resultType: "team",
      resultId: "9",
    }),
    "/de/fixtures/9"
  );
  assert.equal(marketKindToFilterCode("fh"), "1H 0.5");
  assert.equal(marketKindToFilterCode("over25"), "O2.5");
});

test("saved fixture toggle is deterministic and serializable", () => {
  const record: SavedFixtureRecord = {
    id: "7-over15",
    matchId: 7,
    marketCode: "O1.5",
    home: "Home",
    away: "Away",
    league: "League",
    modelProbability: 71,
    savedAt: "2026-07-25T00:00:00.000Z",
  };
  const added = toggleSavedFixture([], record);
  assert.equal(added.length, 1);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(added)));
  const removed = toggleSavedFixture(added, record);
  assert.equal(removed.length, 0);
});

test("availability page uses light Design Bible classes", () => {
  const src = readFileSync(
    path.join(root, "app/[locale]/availability/page.tsx"),
    "utf8"
  );
  assert.match(src, /text-foreground/);
  assert.doesNotMatch(src, /text-white/);
  assert.doesNotMatch(src, /text-slate-300/);
});

test("explorer wires detail error retry and URL deep-open", () => {
  const src = readFileSync(
    path.join(root, "components/bible/BibleFixtureExplorer.tsx"),
    "utf8"
  );
  assert.match(src, /detailError/);
  assert.match(src, /onRetryDetail/);
  assert.match(src, /params\.get\(["']fixture["']\)/);
  assert.match(src, /could not load match evidence/i);
});

test("RankWagersHome sets heading ids and date control props", () => {
  const src = readFileSync(
    path.join(root, "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  assert.match(src, /id="top-picks-heading"/);
  assert.match(src, /id="trending-markets"/);
  assert.match(src, /id="saved-heading"/);
  assert.match(src, /id="verified-performance-heading"/);
  assert.match(src, /HomepageDateControl/);
  assert.match(src, /SavedFixturesPanel/);
  assert.match(src, /homepageFixtureExplorerHref/);
});
