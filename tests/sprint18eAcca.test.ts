import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findAddConflict } from "../lib/acca/conflicts";
import { formatAccaText } from "../lib/acca/exportText";
import { combinedDecimalOdds, stakeModel } from "../lib/acca/odds";
import { assessAccaRisk } from "../lib/acca/risk";
import {
  addSelection,
  clearSlip,
  emptySlip,
  removeSelection,
  setStake,
} from "../lib/acca/rules";
import {
  decodeSharePayload,
  encodeSharePayload,
  slipFromSharePayload,
} from "../lib/acca/share";
import { ACCA_ANALYTICS_EVENTS } from "../lib/acca/analytics";
import { isAccaMarketKey } from "../lib/acca/markets";
import { analyticsEventNames } from "../lib/analytics/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function draft(
  matchId: number,
  marketKey: string,
  odds: number | null = 1.85
) {
  return {
    matchId,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    competition: "Test League",
    marketKey,
    odds,
    confidence: 68,
    matchHref: `/en/fixtures/${matchId}`,
    source: "studio" as const,
  };
}

test("acca markets expose only settlement-backed keys", () => {
  assert.equal(isAccaMarketKey("over25"), true);
  assert.equal(isAccaMarketKey("btts"), true);
  assert.equal(isAccaMarketKey("match_winner"), true);
  assert.equal(isAccaMarketKey("corners"), false);
  assert.equal(isAccaMarketKey("asian_handicap"), false);
});

test("acca add/remove/clear and duplicate fixture conflicts", () => {
  let slip = emptySlip("en");
  const a = addSelection(slip, draft(101, "over25"));
  assert.equal(a.ok, true);
  if (!a.ok) return;
  slip = a.slip;
  assert.equal(slip.selections.length, 1);

  const dup = addSelection(slip, draft(101, "over15"));
  assert.equal(dup.ok, false);
  if (dup.ok) return;
  assert.equal(dup.code, "duplicate_fixture");

  const replaced = addSelection(slip, draft(101, "over15"), {
    replaceFixture: true,
  });
  assert.equal(replaced.ok, true);
  if (!replaced.ok) return;
  slip = replaced.slip;
  assert.equal(slip.selections[0]?.marketKey, "over15");

  const b = addSelection(slip, draft(202, "btts", 1.9));
  assert.equal(b.ok, true);
  if (!b.ok) return;
  slip = b.slip;
  assert.equal(slip.selections.length, 2);

  slip = removeSelection(slip, slip.selections[0]!.id);
  assert.equal(slip.selections.length, 1);
  slip = clearSlip(slip);
  assert.equal(slip.selections.length, 0);
});

test("combined odds stake return and risk are deterministic", () => {
  let slip = emptySlip("en");
  const r1 = addSelection(slip, draft(1, "over15", 1.5));
  assert.equal(r1.ok, true);
  if (!r1.ok) return;
  slip = r1.slip;
  const r2 = addSelection(slip, draft(2, "over25", 2));
  assert.equal(r2.ok, true);
  if (!r2.ok) return;
  slip = r2.slip;

  const combined = combinedDecimalOdds(slip.selections);
  assert.equal(combined.combinedOdds, 3);
  assert.equal(combined.oddsComplete, true);

  slip = setStake(slip, 10);
  const stake = stakeModel(slip.selections, slip.stake);
  assert.equal(stake.potentialReturn, 30);
  assert.equal(stake.potentialProfit, 20);

  const risk = assessAccaRisk(slip.selections);
  assert.ok(
    ["low_risk", "balanced", "aggressive", "very_aggressive"].includes(risk.class)
  );
  assert.ok(risk.reasons.length > 0);
  assert.ok(risk.limitations.length > 0);
});

test("share encode/decode round-trips without inventing odds", () => {
  let slip = emptySlip("en");
  const added = addSelection(slip, draft(55, "over25", null));
  assert.ok(added.ok);
  slip = added.ok ? added.slip : slip;
  const encoded = encodeSharePayload(slip);
  const payload = decodeSharePayload(encoded);
  assert.ok(payload);
  const restored = slipFromSharePayload(payload!, "en");
  assert.equal(restored.selections.length, 1);
  assert.equal(restored.selections[0]?.odds, null);
  assert.equal(restored.selections[0]?.matchId, 55);
});

test("telegram export never claims a bet was placed", () => {
  let slip = emptySlip("en");
  const added = addSelection(slip, draft(9, "btts", 1.8));
  slip = added.ok ? added.slip : slip;
  const text = formatAccaText(slip, { telegram: true });
  assert.match(text, /not a placed bet/i);
  assert.doesNotMatch(text, /bet placed|ticket confirmed/i);
});

test("conflict helper detects same fixture", () => {
  const conflict = findAddConflict(
    [
      {
        id: "1:over25:over",
        matchId: 1,
        marketKey: "over25",
        selectionKey: "over",
      } as never,
    ],
    { id: "1:over15:over", matchId: 1, marketKey: "over15", selectionKey: "over" }
  );
  assert.equal(conflict?.code, "duplicate_fixture");
});

test("acca analytics events are registered", () => {
  for (const name of ACCA_ANALYTICS_EVENTS) {
    assert.ok(analyticsEventNames.includes(name), name);
  }
});

test("acca routes ui provider and server operators exist", () => {
  const files = [
    "lib/acca/types.ts",
    "lib/acca/rules.ts",
    "lib/acca/operators.server.ts",
    "components/acca/AccaProvider.tsx",
    "components/acca/AccaChrome.tsx",
    "components/acca/AddToAccaButton.tsx",
    "components/acca/AccaPanelBody.tsx",
    "app/[locale]/acca/page.tsx",
    "app/api/acca/operators/route.ts",
  ];
  for (const rel of files) {
    assert.ok(readFileSync(path.join(root, rel), "utf8").length > 20, rel);
  }
  const page = readFileSync(path.join(root, "app/[locale]/acca/page.tsx"), "utf8");
  assert.match(page, /index:\s*false/);
  const operators = readFileSync(
    path.join(root, "lib/acca/operators.server.ts"),
    "utf8"
  );
  assert.match(operators, /server-only/);
  assert.match(operators, /buildGoPath/);
  assert.match(operators, /acca_studio/);
  const layout = readFileSync(path.join(root, "app/[locale]/layout.tsx"), "utf8");
  assert.match(layout, /AccaWorkspace/);
  const chrome = readFileSync(
    path.join(root, "components/acca/AccaChrome.tsx"),
    "utf8"
  );
  assert.match(chrome, /BottomSheet/);
  const sheet = readFileSync(
    path.join(root, "components/ui/BottomSheet.tsx"),
    "utf8"
  );
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal/);
});

test("add-to-acca wired on homepage match explorer competition team", () => {
  assert.match(
    readFileSync(path.join(root, "components/bible/RankWagersHome.tsx"), "utf8"),
    /AddToAccaButton/
  );
  assert.match(
    readFileSync(
      path.join(root, "components/bible/BibleFixtureExplorer.tsx"),
      "utf8"
    ),
    /AddToAccaButton/
  );
  assert.match(
    readFileSync(
      path.join(root, "components/fixtures/MatchPredictionsPanel.tsx"),
      "utf8"
    ),
    /AddToAccaButton/
  );
  assert.match(
    readFileSync(
      path.join(root, "components/competitions/CompetitionDetailView.tsx"),
      "utf8"
    ),
    /AddToAccaButton/
  );
  assert.match(
    readFileSync(path.join(root, "components/teams/TeamDetailView.tsx"), "utf8"),
    /AddToAccaButton/
  );
});
