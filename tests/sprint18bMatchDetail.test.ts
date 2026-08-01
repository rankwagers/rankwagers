import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyticsEventNames } from "../lib/analytics/types";
import { filterCodeToMarketKey } from "../lib/fixtures/marketCodes";
import { fixturePath, parseFixtureMatchId } from "../lib/fixtures/paths";
import {
  DEFERRED_SETTLEMENT_MARKETS,
  settlePrediction,
} from "../lib/fixtures/settlement";
import {
  lifecycleLabel,
  resolveMatchLifecycle,
  shouldSoftRefresh,
} from "../lib/fixtures/status";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("fixture path is stable, localized, and market-aware", () => {
  assert.equal(fixturePath("en", 12345), "/en/fixtures/12345");
  assert.equal(
    fixturePath("de", 99, "over25", "saved"),
    "/de/fixtures/99?market=over25&source=saved"
  );
  assert.equal(parseFixtureMatchId("12345"), 12345);
  assert.equal(parseFixtureMatchId("0"), null);
  assert.equal(parseFixtureMatchId("abc"), null);
  assert.equal(parseFixtureMatchId("-1"), null);
});

test("filter codes map to settlement market keys", () => {
  assert.equal(filterCodeToMarketKey("O1.5"), "over15");
  assert.equal(filterCodeToMarketKey("O2.5"), "over25");
  assert.equal(filterCodeToMarketKey("1H 0.5"), "fh");
  assert.equal(filterCodeToMarketKey("2H 0.5"), "sh");
  assert.equal(filterCodeToMarketKey("btts"), "btts");
  assert.equal(filterCodeToMarketKey("Unknown"), null);
});

test("lifecycle mapping covers scheduled live finished and disrupted states", () => {
  const now = 1_700_000_000;
  assert.equal(
    resolveMatchLifecycle({ status: "NS", kickoffUnix: now + 10_000, nowSec: now }),
    "scheduled"
  );
  assert.equal(
    resolveMatchLifecycle({ status: "NS", kickoffUnix: now + 1800, nowSec: now }),
    "pre_match"
  );
  assert.equal(resolveMatchLifecycle({ status: "live", nowSec: now }), "live");
  assert.equal(resolveMatchLifecycle({ status: "HT", nowSec: now }), "half_time");
  assert.equal(resolveMatchLifecycle({ status: "complete", nowSec: now }), "finished");
  assert.equal(resolveMatchLifecycle({ status: "Postponed", nowSec: now }), "postponed");
  assert.equal(resolveMatchLifecycle({ status: "Cancelled", nowSec: now }), "cancelled");
  assert.equal(resolveMatchLifecycle({ status: "Abandoned", nowSec: now }), "abandoned");
  assert.equal(resolveMatchLifecycle({ status: "Suspended", nowSec: now }), "suspended");
  assert.equal(resolveMatchLifecycle({ status: null, kickoffUnix: null }), "unavailable");
  // Kickoff passed with empty status must not fake live
  assert.equal(
    resolveMatchLifecycle({ status: "", kickoffUnix: now - 600, nowSec: now }),
    "unavailable"
  );
  assert.equal(lifecycleLabel("half_time"), "Half-time");
  assert.equal(shouldSoftRefresh("live"), true);
  assert.equal(shouldSoftRefresh("finished"), false);
});

test("settlement: over/under, BTTS, FH/SH, void and push paths", () => {
  assert.equal(
    settlePrediction({
      marketKey: "over15",
      homeScore: 2,
      awayScore: 0,
      htHome: 1,
      htAway: 0,
      status: "complete",
      isFinished: true,
    }).status,
    "won"
  );
  assert.equal(
    settlePrediction({
      marketKey: "over25",
      homeScore: 1,
      awayScore: 1,
      htHome: 0,
      htAway: 1,
      status: "complete",
      isFinished: true,
    }).status,
    "lost"
  );
  assert.equal(
    settlePrediction({
      marketKey: "btts",
      homeScore: 1,
      awayScore: 1,
      htHome: 0,
      htAway: 0,
      status: "complete",
      isFinished: true,
    }).status,
    "won"
  );
  assert.equal(
    settlePrediction(
      {
        marketKey: "fh",
        homeScore: 0,
        awayScore: 0,
        htHome: 0,
        htAway: 0,
        status: "complete",
        isFinished: true,
      },
      1.8
    ).unitProfit,
    -1
  );
  assert.equal(
    settlePrediction({
      marketKey: "sh",
      homeScore: 2,
      awayScore: 0,
      htHome: 1,
      htAway: 0,
      status: "complete",
      isFinished: true,
    }).status,
    "won"
  );
  assert.equal(
    settlePrediction({
      marketKey: "over15",
      homeScore: null,
      awayScore: null,
      htHome: null,
      htAway: null,
      status: "Postponed",
      isFinished: false,
    }).status,
    "void"
  );
  assert.equal(
    settlePrediction({
      marketKey: "over15",
      homeScore: null,
      awayScore: null,
      htHome: null,
      htAway: null,
      status: "Cancelled",
      isFinished: false,
    }).status,
    "cancelled"
  );
  assert.equal(
    settlePrediction({
      marketKey: "draw_no_bet",
      selection: "home",
      homeScore: 1,
      awayScore: 1,
      htHome: 0,
      htAway: 0,
      status: "complete",
      isFinished: true,
    }).status,
    "push"
  );
  assert.equal(
    settlePrediction({
      marketKey: "match_winner",
      selection: "home",
      homeScore: 2,
      awayScore: 1,
      htHome: 1,
      htAway: 0,
      status: "complete",
      isFinished: true,
    }).status,
    "won"
  );
  assert.equal(
    settlePrediction({
      marketKey: "double_chance",
      selection: "X2",
      homeScore: 2,
      awayScore: 0,
      htHome: 1,
      htAway: 0,
      status: "complete",
      isFinished: true,
    }).status,
    "lost"
  );
  assert.ok(DEFERRED_SETTLEMENT_MARKETS.includes("corners"));
  assert.ok(DEFERRED_SETTLEMENT_MARKETS.includes("asian_handicap"));
});

test("match detail route, SEO helpers, and server-only loader exist", () => {
  const page = readFileSync(
    path.join(root, "app/[locale]/fixtures/[matchId]/page.tsx"),
    "utf8"
  );
  assert.match(page, /loadMatchPageBundle/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /pageMetadata/);
  assert.match(page, /index:\s*bundle\.model\.indexable/);

  const loader = readFileSync(
    path.join(root, "lib/fixtures/loadMatchPage.server.ts"),
    "utf8"
  );
  assert.match(loader, /import ["']server-only["']/);
  assert.match(loader, /signAffiliateOffers/);
  assert.match(loader, /settlePrediction/);

  const schema = readFileSync(path.join(root, "lib/fixtures/schema.ts"), "utf8");
  assert.match(schema, /BreadcrumbList/);
  assert.match(schema, /SportsEvent/);
});

test("match detail UI preserves a11y score announcement and state surfaces", () => {
  const view = readFileSync(
    path.join(root, "components/fixtures/MatchDetailView.tsx"),
    "utf8"
  );
  assert.match(view, /aria-label=\{`Score/);
  assert.match(view, /aria-label=["']Breadcrumb["']/);
  assert.match(view, /MatchPredictionsPanel/);
  assert.doesNotMatch(view, /buildGoPath/);
  assert.doesNotMatch(view, /node:crypto/);

  const predictions = readFileSync(
    path.join(root, "components/fixtures/MatchPredictionsPanel.tsx"),
    "utf8"
  );
  assert.match(predictions, /settlementReason|Settlement/);
  assert.doesNotMatch(predictions, /buildGoPath/);
});

test("analytics event names for match detail are registered", () => {
  assert.ok(analyticsEventNames.includes("match_detail_viewed"));
  assert.ok(analyticsEventNames.includes("match_prediction_expanded"));
  assert.ok(analyticsEventNames.includes("match_evidence_viewed"));
  assert.ok(analyticsEventNames.includes("match_detail_retry"));
  assert.ok(analyticsEventNames.includes("match_related_click"));
});

test("explorer and saved surfaces link to canonical fixture paths", () => {
  const explorer = readFileSync(
    path.join(root, "components/bible/BibleFixtureExplorer.tsx"),
    "utf8"
  );
  assert.match(explorer, /Open match page/);
  assert.match(explorer, /fixturePath/);

  const saved = readFileSync(
    path.join(root, "components/bible/SavedFixturesPanel.tsx"),
    "utf8"
  );
  assert.match(saved, /fixturePath/);
  assert.match(saved, /source:\s*["']saved["']|["']saved["']/);
});
