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

test("best-betting-sites is a recorded permanent redirect into /operators", () => {
  /*
   * Re-pinned after the commercial conversion pass: the page this test guarded
   * is RETIRED — the five commercial doors collapse into the operators hub.
   * What must now hold is the retirement itself, not the old variant wiring.
   */
  const src = readFileSync(
    path.join(root, "app/[locale]/best-betting-sites/page.tsx"),
    "utf8"
  );
  assert.match(src, /permanentRedirect/);
  assert.match(src, /RETIRED/);
  assert.doesNotMatch(src, /variant=/);
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
  /*
   * Re-pinned after the commercial conversion pass: the bookmakers group now
   * carries the ONE canonical commercial surface. Retired doors must NOT be
   * navigated to — a nav link to a redirect is a broken promise.
   */
  assert.ok(flat.some((item) => item.href === "/en/operators"));
  for (const gone of ["/en/best-betting-sites", "/en/best-crypto-betting-sites", "/en/bonuses"]) {
    assert.ok(!flat.some((item) => item.href === gone), `${gone} is retired and must leave the nav`);
  }

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
  for (const href of ["/en/operators", "/en/markets", "/en#saved"]) {
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

test("explorer deep-open lands the reader on the row", () => {
  const src = readFileSync(
    path.join(root, "components/bible/BibleFixtureExplorer.tsx"),
    "utf8"
  );
  /*
   * The detail fetch, its error state and the retry button went with the accordion (master fix
   * pass, item 8): rows are LINKS now, and the fixture page owns loading its own evidence. What
   * a deep link still owes the reader is unchanged — filter, page and scroll to the row — so
   * that contract is what remains pinned.
   */
  assert.match(src, /params\.get\(["']fixture["']\)/);
  assert.match(src, /scrollIntoView/);
  assert.doesNotMatch(src, /onRetryDetail|detailError/, "the accordion's fetch machinery is gone");
});

test("RankWagersHome sets heading ids and date control props", () => {
  const src = readFileSync(
    path.join(root, "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  /*
   * `headingId=` rather than `id=`: the section opening is a component now (`V2SectionOpen`), and
   * it applies the id to the `h2` it renders. The anchor is unchanged — what moved is which file
   * writes the attribute. `heroAssembly.test.ts` asserts the RENDERED anchors on the page tree,
   * which is the check a source scan cannot make.
   */
  assert.match(src, /headingId="top-picks-heading"/);
  assert.match(src, /id="trending-markets"/);
  assert.match(src, /id="saved-heading"/);
  assert.match(src, /id="verified-performance-heading"/);
  assert.match(src, /HomepageDateControl/);
  assert.match(src, /SavedFixturesPanel/);
  assert.match(src, /homepageFixtureExplorerHref/);
});
