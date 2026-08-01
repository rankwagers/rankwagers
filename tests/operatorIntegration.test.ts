import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  MANUAL_BOOKMAKER_OVERRIDES,
  bookmakerMappingStats,
  getBookmakerMapping,
  listBookmakerMappings,
  mappingAllowsPositiveAvailability,
  resetBookmakerMappingCache,
  resolveOperatorByAlias,
  resolveOperatorByProviderBookmakerId,
  validateBookmakerMappings,
} from "../lib/operators/bookmaker-mapping";
import {
  CANONICAL_COMBO_MARKETS,
  MANUAL_MARKET_OVERRIDES,
  getMarketMapping,
  listMarketMappings,
  marketMappingIsUsable,
  resetMarketMappingCache,
  validateMarketLineAndPeriod,
  validateMarketMappings,
} from "../lib/operators/market-mapping";
import {
  recordFixtureMappingAttempt,
  resetFixtureMappingStats,
  validateFixtureMapping,
  getFixtureMappingStats,
} from "../lib/operators/fixture-mapping";
import {
  buildOperatorDeeplink,
} from "../lib/operators/build-deeplink";
import {
  listDeeplinkConfigs,
  resetDeeplinkRegistryCache,
} from "../lib/operators/deeplink-registry";
import {
  signRedirectContext,
  verifyRedirectToken,
} from "../lib/operators/redirect-token";
import { buildOperatorsDiagnostics, buildAffiliateDiagnostics } from "../lib/operators/diagnostics";
import { validateOperatorIntegrationConfig } from "../lib/operators/config-validation";
import {
  clearPreparedBookmakerQuotes,
  setPreparedBookmakerQuotes,
} from "../lib/combo/bookmaker-quotes";
import { resolveComboOperatorAvailability } from "../lib/combo/operator-availability";
import { computeOperatorCombinedOdds } from "../lib/combo/operator-availability";
import { classifyOperatorPriceFreshness } from "../lib/combo/operator-freshness";
import {
  createAffiliateClick,
  createMemoryAttributionStore,
  resetAttributionStore,
  setAttributionStore,
  getAttributionStore,
} from "../lib/combo/attribution";
import {
  getPostbackAdapter,
  listPostbackAdapters,
  normalizePostbackPayload,
  processAffiliatePostback,
  resetPostbackRegistryCache,
} from "../lib/affiliate/postbacks";
import { matchOperatorsForCombo } from "../lib/combo/operators";
import { isSafeGoPath } from "../lib/combo/validate";
import type { ComboSelection, EvidenceCombo } from "../lib/combo/types";
import type { Operator } from "../lib/operators/types";
import { analyticsEventNames } from "../lib/analytics/types";

const root = path.resolve(__dirname, "..");
const futureKickoff = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
const nowIso = new Date().toISOString();

function cleanupMappings() {
  MANUAL_BOOKMAKER_OVERRIDES.length = 0;
  MANUAL_MARKET_OVERRIDES.length = 0;
  resetBookmakerMappingCache();
  resetMarketMappingCache();
  resetDeeplinkRegistryCache();
  clearPreparedBookmakerQuotes();
  resetAttributionStore();
  resetPostbackRegistryCache();
  resetFixtureMappingStats();
}

function sampleOperator(slug = "1xbet"): Operator {
  return {
    slug,
    name: "1xBet",
    logo: "/brands/1xbet.png",
    description: "test",
    supportedCountries: [],
    supportedMarkets: ["fh", "over15", "over25", "sh"],
    website: null,
    affiliateEnabled: true,
    verificationStatus: "verified",
    foundedYear: null,
    headquarters: null,
    highlights: [],
    licenses: [],
    apiFootballBookmakerIds: [],
  };
}

function sampleSelection(partial?: Partial<ComboSelection>): ComboSelection {
  return {
    fixtureId: "401",
    fixtureSlug: "arsenal-brighton",
    matchId: 401,
    competitionId: "epl",
    competitionName: "Premier League",
    homeTeamId: "arsenal",
    awayTeamId: "brighton",
    homeTeam: "Arsenal",
    awayTeam: "Brighton",
    kickoffAt: futureKickoff,
    marketId: "over_1_5",
    marketKind: "over15",
    oddsMarketKey: "over15",
    marketLabel: "Over 1.5 Goals",
    odds: 1.45,
    oddsFetchedAt: nowIso,
    oddsFreshness: "current",
    modelProbability: 90,
    evidenceStrength: "strong",
    coverage: 90,
    qualifiedSample: 12,
    qualificationStatus: "passed",
    reasoning: [],
    evidenceSource: "daily_list",
    ...partial,
  };
}

test("bookmaker mapping: 13 unverified shells with empty IDs", () => {
  cleanupMappings();
  const mappings = listBookmakerMappings();
  assert.equal(mappings.length, 13);
  const stats = bookmakerMappingStats(mappings);
  assert.equal(stats.verified, 0);
  assert.equal(stats.configured, 0);
  assert.equal(stats.unverified, 13);
  assert.equal(stats.providerBookmakerIdCount, 0);
  assert.ok(getBookmakerMapping("1xbet"));
  assert.equal(mappingAllowsPositiveAvailability(getBookmakerMapping("1xbet")), false);
});

test("bookmaker mapping: verified/configured with IDs; duplicate and alias collision", () => {
  cleanupMappings();
  MANUAL_BOOKMAKER_OVERRIDES.push({
    operatorId: "1xbet",
    provider: "api-football",
    providerBookmakerIds: ["11"],
    aliases: ["OneXBet"],
    enabled: true,
    confidence: "verified",
    source: "manual_config",
    updatedAt: nowIso,
  });
  MANUAL_BOOKMAKER_OVERRIDES.push({
    operatorId: "melbet",
    provider: "api-football",
    providerBookmakerIds: ["11"],
    aliases: ["onexbet"],
    enabled: true,
    confidence: "configured",
    source: "manual_config",
    updatedAt: nowIso,
  });
  resetBookmakerMappingCache();
  const issues = validateBookmakerMappings();
  assert.ok(issues.some((i) => i.code === "duplicate_provider_id"));
  assert.ok(issues.some((i) => i.code === "alias_collision"));
  assert.equal(mappingAllowsPositiveAvailability(getBookmakerMapping("1xbet")), true);
  assert.equal(resolveOperatorByProviderBookmakerId("11"), undefined); // ambiguous
  cleanupMappings();
  MANUAL_BOOKMAKER_OVERRIDES.push({
    operatorId: "1xbet",
    provider: "api-football",
    providerBookmakerIds: ["22"],
    aliases: ["UniqueAlias"],
    countries: ["NG"],
    enabled: true,
    confidence: "configured",
    source: "manual_config",
    updatedAt: nowIso,
  });
  resetBookmakerMappingCache();
  assert.equal(resolveOperatorByAlias("UniqueAlias")?.operatorId, "1xbet");
  assert.equal(
    resolveOperatorByProviderBookmakerId("22", "NG")?.operatorId,
    "1xbet"
  );
  assert.equal(resolveOperatorByProviderBookmakerId("22", "BR"), undefined);
});

test("bookmaker mapping: disabled operator cannot positively resolve", () => {
  cleanupMappings();
  MANUAL_BOOKMAKER_OVERRIDES.push({
    operatorId: "1xbet",
    provider: "api-football",
    providerBookmakerIds: ["33"],
    aliases: [],
    enabled: false,
    confidence: "verified",
    source: "manual_config",
    updatedAt: nowIso,
  });
  resetBookmakerMappingCache();
  assert.equal(mappingAllowsPositiveAvailability(getBookmakerMapping("1xbet")), false);
  assert.ok(validateBookmakerMappings().some((i) => i.code === "disabled_operator"));
});

test("market mapping: canonical markets disabled until keys; line/period validation", () => {
  cleanupMappings();
  const mappings = listMarketMappings();
  assert.equal(mappings.length, 13 * 4);
  assert.ok(mappings.every((m) => !marketMappingIsUsable(m)));
  for (const market of CANONICAL_COMBO_MARKETS) {
    const row = getMarketMapping("1xbet", market.id)!;
    assert.equal(validateMarketLineAndPeriod(row).ok, true);
  }
  const wrong = {
    ...getMarketMapping("1xbet", "over_1_5")!,
    line: 2.5,
  };
  assert.equal(validateMarketLineAndPeriod(wrong).ok, false);
  const wrongPeriod = {
    ...getMarketMapping("1xbet", "over_1_5")!,
    period: "first_half" as const,
  };
  assert.equal(validateMarketLineAndPeriod(wrongPeriod).ok, false);

  MANUAL_MARKET_OVERRIDES.push({
    operatorId: "1xbet",
    canonicalMarketId: "over_1_5",
    providerMarketId: "goals-over-1.5",
    line: 1.5,
    period: "full_time",
    enabled: true,
    confidence: "configured",
  });
  resetMarketMappingCache();
  assert.equal(marketMappingIsUsable(getMarketMapping("1xbet", "over_1_5")), true);
});

test("fixture mapping: valid, kickoff, team, competition, started, stale", () => {
  cleanupMappings();
  const expected = {
    matchId: 401,
    homeTeam: "Arsenal",
    awayTeam: "Brighton",
    kickoffAt: futureKickoff,
    competition: "Premier League",
  };
  const valid = validateFixtureMapping({
    expected,
    candidate: {
      matchId: 401,
      providerFixtureId: 999,
      homeTeam: "Arsenal",
      awayTeam: "Brighton",
      kickoffAt: futureKickoff,
      competition: "Premier League",
      status: "scheduled",
      snapshotAt: nowIso,
    },
  });
  assert.equal(valid.status, "valid");
  if (valid.status === "valid") assert.equal(valid.canDeeplinkFixture, false);

  assert.equal(
    validateFixtureMapping({
      expected,
      candidate: {
        matchId: 401,
        homeTeam: "Chelsea",
        awayTeam: "Brighton",
        kickoffAt: futureKickoff,
      },
    }).status,
    "invalid"
  );

  assert.equal(
    validateFixtureMapping({
      expected,
      candidate: {
        matchId: 401,
        homeTeam: "Arsenal",
        awayTeam: "Brighton",
        kickoffAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      },
    }).status,
    "invalid"
  );

  assert.equal(
    validateFixtureMapping({
      expected: { ...expected, competition: "Serie A" },
      candidate: {
        matchId: 401,
        homeTeam: "Arsenal",
        awayTeam: "Brighton",
        kickoffAt: futureKickoff,
        competition: "Premier League",
      },
    }).status,
    "invalid"
  );

  assert.equal(
    validateFixtureMapping({
      expected,
      candidate: {
        matchId: 401,
        homeTeam: "Arsenal",
        awayTeam: "Brighton",
        kickoffAt: new Date(Date.now() - 60_000).toISOString(),
      },
    }).status,
    "invalid"
  );

  assert.equal(
    validateFixtureMapping({
      expected,
      candidate: {
        matchId: 401,
        homeTeam: "Arsenal",
        awayTeam: "Brighton",
        kickoffAt: futureKickoff,
        snapshotAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      },
    }).status,
    "invalid"
  );

  recordFixtureMappingAttempt(valid);
  assert.ok(getFixtureMappingStats().attempted >= 1);
});

test("availability: unverified remains unknown; country/disabled unavailable", () => {
  cleanupMappings();
  const op = sampleOperator();
  const selections = [
    sampleSelection(),
    sampleSelection({ matchId: 402, marketId: "over_2_5", marketKind: "over25", oddsMarketKey: "over25" }),
  ];
  const unknown = resolveComboOperatorAvailability({
    operator: op,
    selections,
    country: "NG",
  });
  assert.equal(unknown.availability, "unknown");
  assert.equal(unknown.availableCount, 0);

  const restricted: Operator = {
    ...op,
    supportedCountries: ["NG"],
  };
  const blocked = resolveComboOperatorAvailability({
    operator: restricted,
    selections,
    country: "BR",
  });
  assert.equal(blocked.availability, "none");
  assert.equal(blocked.countryEligible, false);

  const disabled = resolveComboOperatorAvailability({
    operator: { ...op, affiliateEnabled: false },
    selections,
  });
  assert.equal(disabled.availability, "none");
});

test("availability + odds: verified mapping with quotes yields full and combined odds", () => {
  cleanupMappings();
  MANUAL_BOOKMAKER_OVERRIDES.push({
    operatorId: "1xbet",
    provider: "api-football",
    providerBookmakerIds: ["55"],
    aliases: [],
    enabled: true,
    confidence: "verified",
    source: "manual_config",
    updatedAt: nowIso,
  });
  resetBookmakerMappingCache();
  for (const market of CANONICAL_COMBO_MARKETS) {
    MANUAL_MARKET_OVERRIDES.push({
      operatorId: "1xbet",
      canonicalMarketId: market.id,
      providerMarketId: `pm-${market.id}`,
      line: market.line,
      period: market.period,
      enabled: true,
      confidence: "configured",
    });
  }
  resetMarketMappingCache();

  setPreparedBookmakerQuotes([
    {
      matchId: 401,
      oddsKey: "over15",
      canonicalMarketId: "over_1_5",
      providerBookmakerId: "55",
      decimal: 1.4,
      observedAt: nowIso,
    },
    {
      matchId: 402,
      oddsKey: "over25",
      canonicalMarketId: "over_2_5",
      providerBookmakerId: "55",
      decimal: 1.8,
      observedAt: nowIso,
    },
    {
      matchId: 402,
      oddsKey: "over25",
      canonicalMarketId: "over_2_5",
      providerBookmakerId: "99",
      decimal: 2.2,
      observedAt: nowIso,
    },
  ]);

  const selections = [
    sampleSelection({ matchId: 401 }),
    sampleSelection({
      matchId: 402,
      marketId: "over_2_5",
      marketKind: "over25",
      oddsMarketKey: "over25",
    }),
  ];
  const full = resolveComboOperatorAvailability({
    operator: sampleOperator(),
    selections,
  });
  assert.equal(full.availability, "full");
  assert.equal(full.operatorCombinedOdds, 2.52);

  // Mixed bookmaker legs rejected for combined odds
  const mixed = computeOperatorCombinedOdds([
    {
      status: "available",
      odds: 1.4,
      providerBookmakerId: "55",
      verifiedAt: nowIso,
      priceFreshness: "current",
    },
    {
      status: "available",
      odds: 1.8,
      providerBookmakerId: "99",
      verifiedAt: nowIso,
      priceFreshness: "current",
    },
  ]);
  assert.equal(mixed.combinedOdds, undefined);

  // Stale quote → unknown priced availability
  setPreparedBookmakerQuotes([
    {
      matchId: 401,
      oddsKey: "over15",
      canonicalMarketId: "over_1_5",
      providerBookmakerId: "55",
      decimal: 1.4,
      observedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  const stale = resolveComboOperatorAvailability({
    operator: sampleOperator(),
    selections: [sampleSelection()],
  });
  assert.equal(stale.availability, "unknown");
  assert.equal(
    classifyOperatorPriceFreshness(
      new Date(Date.now() - 45 * 60 * 1000).toISOString()
    ),
    "stale"
  );
  assert.equal(
    classifyOperatorPriceFreshness(
      new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    ),
    "unavailable"
  );
});

test("deeplinks: homepage fallback; no betslip; host/token security", () => {
  cleanupMappings();
  const built = buildOperatorDeeplink({
    operatorId: "1xbet",
    subid: "test",
    preferred: "betslip",
  });
  assert.equal(built.deeplinkType, "homepage");
  assert.ok(built.fallbackReason);
  assert.ok(built.destinationUrl.startsWith("https://"));
  assert.ok(!built.destinationUrl.includes("{subid}"));

  const configs = listDeeplinkConfigs();
  assert.ok(configs.every((c) => !c.capabilities.includes("betslip")));
  assert.ok(configs.every((c) => c.capabilities.includes("homepage")));

  const token = signRedirectContext({
    operatorId: "1xbet",
    comboId: "c1",
    placement: "combo_studio",
    availability: "unknown",
    deeplinkType: "homepage",
  });
  assert.equal(verifyRedirectToken(token, "1xbet").ok, true);
  const tampered = token.split(".");
  tampered[2] = `${tampered[2].slice(0, -4)}abcd`;
  assert.equal(verifyRedirectToken(tampered.join("."), "1xbet").ok, false);
  assert.equal(verifyRedirectToken(token, "melbet").ok, false);
  const expired = signRedirectContext({
    operatorId: "1xbet",
    ttlMs: 1_000,
    now: Date.now() - 60_000,
  });
  const expiredResult = verifyRedirectToken(expired, "1xbet");
  assert.equal(expiredResult.ok, false);
  if (!expiredResult.ok) assert.equal(expiredResult.reason, "expired");

  assert.equal(isSafeGoPath("/go/1xbet?ctx=abc"), true);
  assert.equal(isSafeGoPath("https://evil.com"), false);
});

test("attribution: click create, duplicate, no sensitive fields", async () => {
  cleanupMappings();
  const store = createMemoryAttributionStore();
  setAttributionStore(store);
  const a = await createAffiliateClick({
    operatorId: "1xbet",
    locale: "en",
    placement: "combo_studio",
    availability: "unknown",
    deeplinkType: "homepage",
    idempotencyKey: "dup-1",
  });
  assert.equal(a.created, true);
  const b = await createAffiliateClick({
    operatorId: "1xbet",
    locale: "en",
    placement: "combo_studio",
    availability: "unknown",
    deeplinkType: "homepage",
    idempotencyKey: "dup-1",
  });
  assert.equal(b.created, false);
  assert.equal(a.record.clickId, b.record.clickId);
  const json = JSON.stringify(a.record);
  assert.doesNotMatch(json, /"ip"|"userAgent"|"email"/);
  assert.equal((await getAttributionStore().stats()).clickCount, 1);
});

test("postbacks: disabled adapters return not_configured", async () => {
  cleanupMappings();
  assert.equal(listPostbackAdapters().length, 13);
  assert.equal(getPostbackAdapter("1xbet")?.status, "not_configured");
  const result = await processAffiliatePostback({
    operatorSlug: "1xbet",
    body: { click_id: "x", type: "first_deposit" },
    rawBody: "{}",
    headers: new Headers(),
  });
  assert.equal(result.status, "not_configured");

  const adapter = getPostbackAdapter("1xbet")!;
  assert.equal(
    normalizePostbackPayload({
      adapter: { ...adapter, status: "configured", authMethod: "shared_secret" },
      body: { type: "not_a_type" },
    }).ok,
    false
  );
  assert.equal(
    normalizePostbackPayload({
      adapter: { ...adapter, status: "configured", authMethod: "shared_secret" },
      body: { type: "first_deposit", amount: -1, currency: "USD" },
    }).ok,
    false
  );
  assert.equal(
    normalizePostbackPayload({
      adapter: { ...adapter, status: "configured", authMethod: "shared_secret" },
      body: { type: "first_deposit", amount: 10, currency: "US" },
    }).ok,
    false
  );
});

test("ranking: full above partial above unknown; unknown never best_match", () => {
  cleanupMappings();
  const combo: EvidenceCombo = {
    id: "combo_test",
    request: {
      locale: "en",
      country: "NG",
      targetOddsMin: 2,
      targetOddsMax: 5,
      riskProfile: "balanced",
      marketPreferences: ["mixed"],
      maxSelections: 2,
    },
    selections: [
      sampleSelection(),
      sampleSelection({
        matchId: 402,
        marketId: "over_2_5",
        marketKind: "over25",
        oddsMarketKey: "over25",
      }),
    ],
    combinedOdds: 2.5,
    targetDistance: 0,
    inTargetRange: true,
    averageCoverage: 90,
    aggregateEvidenceStrength: "strong",
    totalQualifiedSample: 24,
    score: 1,
    generatedAt: nowIso,
    oddsFreshness: "current",
  };
  const rows = matchOperatorsForCombo(combo);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.availability === "unknown"));
  assert.ok(!rows.some((r) => r.badge === "best_match"));
  assert.ok(rows.every((r) => !r.outboundPath || isSafeGoPath(r.outboundPath)));
  assert.ok(rows.every((r) => r.outboundPath.includes("ctx=") || !r.outboundPath));
});

test("UI copy and developer surfaces exist", async () => {
  const card = readFileSync(
    path.join(root, "components/combo/ComboOperatorCard.tsx"),
    "utf8"
  );
  assert.match(card, /Verified availability|Availability could not be confirmed/);
  assert.match(card, /Combined operator odds unavailable/);
  assert.match(card, /Opens operator homepage/);
  for (const rel of [
    "app/developer/combo/page.tsx",
    "app/developer/operators/page.tsx",
    "app/api/operators/diagnostics/route.ts",
    "app/api/affiliate/diagnostics/route.ts",
    "app/api/affiliate/postback/[operatorSlug]/route.ts",
    "docs/operator-mapping.md",
    "docs/operator-deeplinks.md",
    "docs/operator-availability.md",
    "docs/affiliate-attribution.md",
    "docs/affiliate-postbacks.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
  for (const name of [
    "affiliate_redirect_created",
    "postback_received",
    "affiliate_ftd",
  ] as const) {
    assert.ok(analyticsEventNames.includes(name));
  }
  const opDiag = buildOperatorsDiagnostics();
  assert.equal(opDiag.bookmakerMappings.unverified, 13);
  const aff = await buildAffiliateDiagnostics();
  assert.equal(aff.postbackAdapters.configured, 0);
  const cfg = validateOperatorIntegrationConfig();
  assert.ok(cfg.warnings.some((w) => /unverified/i.test(w)));
});

test("go route rejects client destination params", () => {
  const source = readFileSync(path.join(root, "app/go/[brand]/route.ts"), "utf8");
  assert.match(source, /client_destination_ignored/);
  assert.match(source, /verifyRedirectToken/);
  assert.match(source, /createAffiliateClick/);
  assert.match(source, /buildOperatorDeeplink/);
  assert.doesNotMatch(source, /searchParams\.get\(["']destination["']\)\s*\|\|/);
});
