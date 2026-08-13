import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

/**
 * THE LANGUAGE & LOOSE-ENDS SWEEP — probes for blocks 4–7.
 * (Block 1's zero ceiling lives in localeVocabularySweep; block 2's nav is
 * pinned by sprint18aIntegrity; block 3 is reported separately.)
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { buildResearchTeamDocuments } =
  require("../lib/search/researchTeamDocuments") as typeof import("../lib/search/researchTeamDocuments");
const { normalizeSearchQuery } =
  require("../lib/search/normalizer") as typeof import("../lib/search/normalizer");
const { signalScopeText } =
  require("../lib/fixtures/signalPresentation") as typeof import("../lib/fixtures/signalPresentation");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");
const { createDeriveCaptureInput } =
  require("../lib/evidence-capture/candidates/derive-capture-input") as typeof import("../lib/evidence-capture/candidates/derive-capture-input");
const { venueStatsFromTeam } =
  require("../lib/footystats/matchDetail") as typeof import("../lib/footystats/matchDetail");

import type { FixtureSignal } from "../lib/fixtureSignals";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/* ── 4 · /how-we-rank and /methodology are both canonical, decided ──────── */

test("the how-we-rank / methodology separation is decided and recorded", () => {
  const page = SRC("app/[locale]/how-we-rank/page.tsx");
  assert.match(page, /DECIDED/, "the decision is recorded in the code");
  // the comment wraps with a ` * ` continuation between the words
  assert.match(page, /BOTH[\s*]+canonical/, "both pages are canonical");
  assert.match(SRC("docs/route-inventory.md"), /`\/how-we-rank` and `\/methodology` are BOTH canonical/);
  // The cross-links that make the separation navigable exist in both directions.
  assert.match(page, /\/methodology/);
  assert.match(SRC("app/[locale]/methodology/page.tsx"), /how-we-rank/);
});

/* ── 5 · the capture gap: competitionId/seasonId populated forward-only ─── */

test("new captures carry competitionId and seasonId when the source has them", () => {
  const side = (venue: "home" | "away") =>
    venueStatsFromTeam(
      {
        [`seasonMatchesPlayed_${venue}`]: 10,
        [`seasonOver25Num_${venue}`]: 6,
        [`seasonOver25Percentage_${venue}`]: 60,
      },
      venue
    );
  const detail = {
    matchId: 8412573,
    providerSeasonId: 14257,
    homeTeam: "A",
    awayTeam: "B",
    homeAtHome: side("home"),
    awayAtAway: side("away"),
    matchPotential: { over15: 70, over25: 55, fh05: 60, sh05: 65 },
    leagueSeason: { played: 120, avgGoals: 2.6, over15: 70, over25: 50, fh05: 60, sh05: 70, btts: 50 },
    history: { homeAtHome: [], awayAtAway: [], headToHead: [] },
    ai: null,
  };
  const derive = createDeriveCaptureInput({ get: () => detail as never } as never);
  const result = derive({
    fixtureId: 8412573,
    kickoffAt: "2026-08-13T17:00:00Z",
    capturedAt: "2026-08-13T16:10:00Z",
    leagueCode: "NO2",
    competitionLabel: "2. Division",
    markets: [{ marketKey: "over25", selectionKey: "over" }] as never,
    healing: false,
  });
  assert.equal(result.ok, true, "derivation must succeed on scorable input");
  if (result.ok) {
    assert.equal((result as { competitionId?: string | null }).competitionId, "NO2");
    assert.equal((result as { seasonId?: string | null }).seasonId, "14257");
  }
  // And absence stays absence — a detail without the provider id sets null, never invents.
  const bare = createDeriveCaptureInput({
    get: () => ({ ...detail, providerSeasonId: undefined }) as never,
  } as never)({
    fixtureId: 8412573,
    kickoffAt: "2026-08-13T17:00:00Z",
    capturedAt: "2026-08-13T16:10:00Z",
    leagueCode: "NO2",
    competitionLabel: "2. Division",
    markets: [{ marketKey: "over25", selectionKey: "over" }] as never,
    healing: false,
  });
  if (bare.ok) assert.equal((bare as { seasonId?: string | null }).seasonId, null);
});

/* ── 6 · the research team indexer (the Levadia backlog) ────────────────── */

test("levadia matches once its name appears in the research set", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rw-archives-"));
  writeFileSync(
    path.join(dir, "2026-08-13.json"),
    JSON.stringify({
      date: "2026-08-13",
      over25: [
        { matchId: 900001, homeTeam: "FCI Levadia", awayTeam: "Nomme Kalju", competition: "Meistriliiga", country: "Estonia" },
        { matchId: 900002, homeTeam: "Arsenal", awayTeam: "Chelsea", competition: "Premier League", country: "England" },
      ],
    })
  );
  const docs = buildResearchTeamDocuments({ archiveDir: dir });
  const levadia = docs.find((d) => d.normalizedTitle.includes(normalizeSearchQuery("levadia")));
  assert.ok(levadia, "a research team document must exist for FCI Levadia");
  assert.equal(levadia!.entityType, "team");
  assert.match(levadia!.id, /^research-team:/, "clearly typed as a research entry");
  assert.equal(levadia!.pathTemplate, "/fixtures/900001", "routes to the fixture it appeared in");
  // Deduped against the registry: Arsenal is a registered team and must NOT duplicate.
  assert.equal(
    docs.some((d) => d.normalizedTitle === normalizeSearchQuery("Arsenal")),
    false,
    "registry teams keep their richer document — no research duplicate"
  );
});

test("research team hrefs never point at nonexistent team pages", () => {
  const resolver = SRC("lib/search/resolver.ts");
  assert.match(resolver, /research-team:/, "the resolver knows the research type");
  assert.match(resolver, /document\.pathTemplate/, "and honours the document's own destination");
});

test("search keeps zero commercial presence after the indexer", () => {
  // The new module carries nothing commercial; the indexer's pre-existing
  // operator-doc eligibility check (affiliateEnabled) is registry metadata,
  // not a commercial link — the signing/sponsored markers are what must
  // never appear in the search graph.
  for (const marker of ["buildGoPath", "sponsored", "affiliateEnabled", "operatorAffiliateHref"]) {
    assert.equal(
      SRC("lib/search/researchTeamDocuments.ts").includes(marker),
      false,
      `researchTeamDocuments grew commercial presence (${marker})`
    );
  }
  for (const marker of ["buildGoPath", "sponsored", "operatorAffiliateHref"]) {
    assert.equal(
      SRC("lib/search/indexer.ts").includes(marker),
      false,
      `indexer grew commercial presence (${marker})`
    );
  }
});

/* ── 7 · cosmetics ──────────────────────────────────────────────────────── */

test("an s-ending team name takes the bare apostrophe in the EN grammar", () => {
  const signal = {
    market: "over25",
    direction: "above_baseline",
    count: 4,
    sample: 7,
    rate: 4 / 7,
    baseline: 0.5,
    scope: "home_venue",
    window: "season",
    score: 0.1,
    level: "support",
  } as FixtureSignal;
  const withS = signalScopeText(signal, { home: "Brisbane Knights", away: "X" }, predictionsEn);
  assert.ok(withS.includes("Brisbane Knights'"), `got: ${withS}`);
  assert.equal(withS.includes("Knights's"), false, "the shipped double-s is dead");
  const withoutS = signalScopeText(signal, { home: "Molde", away: "X" }, predictionsEn);
  assert.ok(withoutS.includes("Molde's"), "regular names keep the full possessive");
});

test("a small top share renders the neutral lead, not a concentration claim", () => {
  for (const file of [
    "components/markets/MarketDetailView.tsx",
    "components/competitions/CompetitionDetailView.tsx",
  ]) {
    assert.match(
      SRC(file),
      /leadPct >= 25 \? p\.(mkt|cmp)LeadLine : p\.(mkt|cmp)LeadLineNeutral/,
      `${file} thresholds the concentration claim`
    );
  }
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<string, string>;
    for (const key of ["mktLeadLineNeutral", "cmpLeadLineNeutral"]) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
      for (const ph of ["{count}", "{total}", "{pct}"]) {
        assert.ok(dict[key].includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

/* ── nv keys locale coverage (block 2) ──────────────────────────────────── */

test("every nv key exists translated in every locale set", () => {
  const NV_KEYS = Object.keys(predictionsEn).filter((k) => /^nv[A-Z]/.test(k));
  assert.equal(NV_KEYS.length, 15, `expected 15 nv keys, found ${NV_KEYS.length}`);
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<string, string>;
    for (const key of NV_KEYS) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
      assert.ok(dict[key].length > 0, `${locale}.${key} empty`);
    }
  }
});
