import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  clearPreparedComboData,
  ENABLED_MARKETS,
  getPreparedComboData,
  hydrateComboDomainSnapshot,
  prepareComboData,
  TARGET_PRESETS,
  UNSUPPORTED_MARKETS,
} from "../lib/combo";
import { buildPublicRouteInventory, expectedSitemapUrls } from "../lib/crawl-quality";
import { locales } from "../lib/i18n";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";
import { pageMetadata } from "../lib/seo";
import { analyticsEventNames } from "../lib/analytics/types";

const root = path.resolve(__dirname, "..");
const futureKickoff = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
const oddsFetchedAt = new Date().toISOString();

function fixture(
  matchId: number,
  kind: QualifiedFixture["marketKind"],
  home: string,
  away: string,
  league: string,
  modelProbability: number
): QualifiedFixture {
  return {
    id: `${matchId}-${kind}`,
    matchId,
    marketKind: kind,
    league,
    country: "England",
    leagueCode: "EPL",
    home,
    away,
    kickoff: "Tonight",
    kickoffDateTime: futureKickoff,
    market: kind,
    marketCode: kind,
    modelProbability,
    updatedAt: "just now",
    updatedDateTime: oddsFetchedAt,
    venue: "Venue data pending",
    operatorStatus: "unavailable",
  };
}

function sampleFixtures(): QualifiedFixture[] {
  return [
    fixture(401, "over15", "Arsenal", "Brighton", "Premier League", 94),
    fixture(402, "over15", "PSV", "AZ", "Eredivisie", 91),
    fixture(403, "over25", "Inter", "Torino", "Serie A", 78),
  ];
}

function sampleOdds(fixtures: QualifiedFixture[]) {
  return fixtures.map((f, i) => ({
    matchId: f.matchId,
    oddsKey:
      f.marketKind === "over15"
        ? "over15"
        : f.marketKind === "over25"
          ? "over25"
          : f.marketKind === "fh"
            ? "fh"
            : "sh",
    decimal: 1.45 + i * 0.15,
    fetchedAt: oddsFetchedAt,
  }));
}

test("combo route, studio components, and docs exist", () => {
  for (const rel of [
    "app/[locale]/combo/page.tsx",
    "components/combo/ComboStudio.tsx",
    "components/combo/ComboForm.tsx",
    "components/combo/ComboResult.tsx",
    "components/combo/ComboSelectionCard.tsx",
    "components/combo/ComboOperatorSection.tsx",
    "components/combo/ComboOperatorCard.tsx",
    "components/combo/ComboOperatorComparison.tsx",
    "components/combo/ComboStickyBar.tsx",
    "components/combo/ComboOperatorSheet.tsx",
    "components/combo/ComboHomepageLauncher.tsx",
    "lib/combo/prepare.ts",
    "lib/combo/analytics.ts",
    "lib/combo/persistence.ts",
    "docs/combo-ui.md",
    "docs/combo-engine.md",
    "docs/operator-matching.md",
    "docs/combo-methodology.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("prepareComboData: successful snapshot is deterministic and persists optionally", async () => {
  clearPreparedComboData();
  const fixtures = sampleFixtures();
  const odds = sampleOdds(fixtures);
  const a = await prepareComboData({
    fixtures,
    odds,
    persist: false,
    now: Date.parse("2026-07-25T12:00:00.000Z"),
  });
  assert.equal(getPreparedComboData(), null, "persist:false must not leave global state");
  assert.equal(a.client.empty, false);
  assert.equal(a.client.fixtureCount, 3);
  assert.equal(a.client.oddsCount, 3);
  assert.match(a.client.snapshotId, /^snap_[a-f0-9]{12}$/);
  assert.equal(a.client.oddsFreshness, "current");

  const b = await prepareComboData({
    fixtures,
    odds,
    persist: false,
    now: Date.parse("2026-07-25T12:00:00.000Z"),
  });
  assert.equal(a.client.snapshotId, b.client.snapshotId);

  const persisted = await prepareComboData({
    fixtures,
    odds,
    persist: true,
  });
  assert.equal(getPreparedComboData()?.snapshotId, persisted.client.snapshotId);
  clearPreparedComboData();
});

test("prepareComboData: empty snapshot and hydrate injection", async () => {
  clearPreparedComboData();
  const empty = await prepareComboData({
    fixtures: [],
    odds: [],
    persist: false,
  });
  assert.equal(empty.client.empty, true);
  assert.equal(empty.client.fixtureCount, 0);
  assert.equal(empty.client.oddsFreshness, "unavailable");

  const hydrated = hydrateComboDomainSnapshot({
    fixtures: sampleFixtures(),
    odds: sampleOdds(sampleFixtures()),
    persist: false,
  });
  assert.equal(getPreparedComboData(), null);
  assert.equal(hydrated.fixtureCount, 3);
  assert.ok(hydrated.oddsCount > 0);
});

test("form defaults and supported markets only", () => {
  assert.deepEqual(
    TARGET_PRESETS.map((p) => p.id),
    ["1.5-2.0", "2.0-3.0", "3.0-5.0", "5.0+"]
  );
  const balanced = TARGET_PRESETS.find((p) => p.id === "2.0-3.0");
  assert.ok(balanced);
  assert.equal(balanced.min, 2);
  assert.equal(balanced.max, 3);
  assert.equal(ENABLED_MARKETS.length, 4);
  for (const market of ENABLED_MARKETS) {
    assert.equal(market.enabled, true);
  }
  for (const market of UNSUPPORTED_MARKETS) {
    assert.equal(market.enabled, false);
  }
  const formSource = readFileSync(
    path.join(root, "components/combo/MarketPreferenceSelector.tsx"),
    "utf8"
  );
  assert.match(formSource, /ENABLED_MARKETS/);
  assert.doesNotMatch(formSource, /btts|1X2|Double Chance|Draw No Bet/i);
});

test("studio reuses evidence UI and avoids AI generation copy", () => {
  const selection = readFileSync(
    path.join(root, "components/combo/ComboSelectionCard.tsx"),
    "utf8"
  );
  assert.match(selection, /EvidenceStrengthBadge|ComboReasoningPanel/);
  const reasoning = readFileSync(
    path.join(root, "components/combo/ComboReasoningPanel.tsx"),
    "utf8"
  );
  assert.match(reasoning, /QualificationPanel/);
  assert.match(reasoning, /BaselineComparison/);
  assert.match(reasoning, /SampleQualityBlock/);
  assert.match(reasoning, /ProvenanceBlock/);
  assert.match(reasoning, /EvidenceStrengthBadge/);
  const studio = readFileSync(path.join(root, "components/combo/ComboStudio.tsx"), "utf8");
  assert.doesNotMatch(studio, /AI is generating|ChatGPT|LLM picks/i);
  assert.match(studio, /aria-live=["']polite["']/);
  assert.match(studio, /generateComboRequest/);
  assert.match(studio, /replaceComboRequest/);
  assert.match(studio, /removeComboRequest/);
});

test("operator card: coverage badge only for full; unknown copy; /go CTA path", () => {
  const card = readFileSync(
    path.join(root, "components/combo/ComboOperatorCard.tsx"),
    "utf8"
  );
  assert.match(card, /availability === ["']full["']/);
  assert.match(card, /All selections covered/);
  assert.match(card, /could not be confirmed|could not be verified/i);
  assert.match(card, /outboundPath/);
  assert.doesNotMatch(card, /matchScore|commercialPriority/);
});

test("mobile sticky bar and operator sheet a11y contracts", () => {
  const sticky = readFileSync(
    path.join(root, "components/combo/ComboStickyBar.tsx"),
    "utf8"
  );
  assert.match(sticky, /safe-area-inset-bottom/);
  assert.match(sticky, /View Operators/);
  assert.match(sticky, /md:hidden/);
  const sheet = readFileSync(
    path.join(root, "components/combo/ComboOperatorSheet.tsx"),
    "utf8"
  );
  assert.match(sheet, /aria-modal=["']true["']/);
  assert.match(sheet, /Escape/);
  assert.match(sheet, /safe-area-inset-bottom/);
});

test("homepage Acca entry and header link to combo", () => {
  const home = readFileSync(
    path.join(root, "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  assert.match(home, /HomepageAccaEntry/);
  assert.doesNotMatch(home, /ComboHomepageLauncher/);
  const entry = readFileSync(
    path.join(root, "components/homepage/HomepageAccaEntry.tsx"),
    "utf8"
  );
  assert.match(entry, /\/acca/);
  assert.match(entry, /\/combo/);
  const launcher = readFileSync(
    path.join(root, "components/combo/ComboHomepageLauncher.tsx"),
    "utf8"
  );
  assert.match(launcher, /\/combo/);
  assert.match(launcher, /Build My Combo/);
  const header = readFileSync(path.join(root, "components/Header.tsx"), "utf8");
  assert.match(header, /buildPrimaryNav/);
  const primaryNav = readFileSync(
    path.join(root, "lib/navigation/primaryNav.ts"),
    "utf8"
  );
  assert.match(primaryNav, /\/combo/);
});

test("combo analytics events are registered", () => {
  const required = [
    "combo_studio_view",
    "combo_builder_start",
    "combo_target_select",
    "combo_risk_profile_select",
    "combo_market_select",
    "combo_selection_limit_set",
    "combo_generate_start",
    "combo_generate_success",
    "combo_generate_failure",
    "combo_result_view",
    "combo_selection_expand",
    "combo_selection_replace_start",
    "combo_selection_replace_success",
    "combo_selection_replace_failure",
    "combo_selection_remove",
    "combo_alternative_view",
    "combo_alternative_select",
    "combo_copy",
    "combo_operator_section_view",
    "combo_operator_card_view",
    "combo_operator_compare_open",
    "combo_operator_click",
    "combo_deeplink_click",
  ];
  for (const name of required) {
    assert.ok(analyticsEventNames.includes(name as never), name);
  }
});

test("crawl inventory includes /combo as non-indexable redirect; excluded from sitemap", () => {
  const routes = buildPublicRouteInventory();
  const combo = routes.find((r) => r.path === "/combo");
  assert.ok(combo);
  assert.equal(combo.kind, "hub");
  assert.equal(combo.indexable, false);

  for (const locale of locales.slice(0, 3)) {
    const meta = pageMetadata({
      locale,
      path: "/combo",
      title: "Evidence Combo Studio",
      description: "Build evidence-supported combinations",
      index: false,
    });
    assert.match(String(meta.alternates?.canonical ?? ""), new RegExp(`/${locale}/combo$`));
  }

  const urls = expectedSitemapUrls();
  assert.ok(
    !urls.some((url) => /\/combo(\?|$)/.test(url)),
    "redirect /combo must not appear in sitemap (Sprint 22)"
  );
});

test("summary honesty: proxy sample wording present", () => {
  const summary = readFileSync(
    path.join(root, "components/combo/ComboSummary.tsx"),
    "utf8"
  );
  assert.match(summary, /proxy/i);
  assert.doesNotMatch(summary, /guaranteed|sure win|banker|risk-free/i);
});
