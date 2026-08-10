import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE TRUTH HOTFIX — four live defects from review of the deployed batch.
 *
 *   1 · a short alias ("ol") hid inside an unrelated name ("m-ol-de") and the
 *       fuzzy tier routed "Molde II" to /teams/lyon. Fuzzy now matches whole
 *       tokens only and never across an identity-bearing token (II/B/U21…).
 *   2 · competition/team pages linked every country field to /countries/{code}
 *       unconditionally; unconfigured codes (FR) 404'd live. Links now render
 *       only when the hub exists; every hub-listed code must resolve.
 *   3 · an absent provider rate coerced to 0 and inverted into a perfect
 *       "shut out: 11 of 11 (100%)" lead. Missing is missing, not zero: an
 *       unmeasured stat can never yield a scored signal in either direction.
 *   4 · the global 404 pages moved to the form-guide register with dictionary
 *       strings in all locales.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { resolveTeam } = require("../lib/teams/resolver") as typeof import("../lib/teams/resolver");
const { listTeams, getTeam } =
  require("../lib/teams/registry") as typeof import("../lib/teams/registry");
const {
  buildCountryLanding,
  countryHubHref,
  isConfiguredCountryCode,
  listIndexableCountryCodes,
} = require("../lib/countries/landing") as typeof import("../lib/countries/landing");
const { venueStatsFromTeam } =
  require("../lib/footystats/matchDetail") as typeof import("../lib/footystats/matchDetail");
const { scoreFixtureSignals } =
  require("../lib/fixtureSignals") as typeof import("../lib/fixtureSignals");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/* ── 1 · team routing ───────────────────────────────────────────────────── */

test("a resolved team href round-trips to the same team's identity", () => {
  // Real-shape names including II/B variants, accents, s-endings. Whatever the
  // resolver matches must resolve BACK to the same slug from the team's own name.
  const names = [
    "Molde II",
    "Kvik Trondheim",
    "Real Madrid B",
    "Åsane",
    "Molde",
    "Rangers",
    "Lyon",
    "Olympique Lyonnais",
    "OL",
    "Arsenal FC",
    "FC Bayern München",
  ];
  for (const name of names) {
    const resolved = resolveTeam(listTeams(), { name });
    if (resolved.status !== "matched") continue;
    const back = resolveTeam(listTeams(), { name: resolved.team.name });
    assert.equal(back.status, "matched", `${name}: registry name must resolve`);
    if (back.status === "matched") {
      assert.equal(
        back.team.slug,
        resolved.team.slug,
        `${name} resolved to ${resolved.team.slug} but the round-trip diverged`
      );
    }
  }
});

test("the live wrong-team case is dead: Molde II never resolves to lyon", () => {
  for (const name of ["Molde II", "Kvik Trondheim", "molde ii"]) {
    const resolved = resolveTeam(listTeams(), { name });
    assert.notEqual(
      resolved.status === "matched" ? resolved.team.slug : null,
      "lyon",
      `${name} routed to Lyon again`
    );
  }
  // The short alias still works as an EXACT alias — only substring bleed died.
  const ol = resolveTeam(listTeams(), { name: "OL" });
  assert.equal(ol.status, "matched");
  if (ol.status === "matched") assert.equal(ol.team.slug, "lyon");
});

test("a reserve side never inherits the first team's page, in either direction", () => {
  for (const name of ["Real Madrid B", "Arsenal II", "Bayern Munich II", "Liverpool U21"]) {
    const resolved = resolveTeam(listTeams(), { name });
    assert.notEqual(resolved.status, "matched", `${name} must not match a first team`);
  }
});

/* ── 2 · countries ──────────────────────────────────────────────────────── */

test("every country listed on the hub resolves against the route's acceptance", () => {
  const codes = listIndexableCountryCodes();
  assert.ok(codes.length > 0, "the hub lists at least one country");
  for (const code of codes) {
    // the hub link emits the lowercased code; the route accepts case-insensitively
    const emitted = code.toLowerCase();
    assert.ok(isConfiguredCountryCode(emitted), `${code}: route rejects the emitted param`);
    assert.ok(buildCountryLanding("en" as never, emitted), `${code}: model must build`);
    assert.ok(countryHubHref("en", code), `${code}: hub href must exist`);
  }
});

test("an unconfigured country renders as a label, never a 404 link", () => {
  assert.equal(isConfiguredCountryCode("FR"), false, "FR is the live 404 case");
  assert.equal(countryHubHref("en", "FR"), null);
  for (const file of [
    "components/competitions/CompetitionDetailView.tsx",
    "components/teams/TeamDetailView.tsx",
  ]) {
    const src = SRC(file);
    assert.ok(src.includes("countryHubHref"), `${file} must use the guarded href`);
    assert.equal(
      src.includes("countryPath(locale"),
      false,
      `${file} still emits an unguarded country link`
    );
  }
});

/* ── 3 · the 100% shut-out plague ───────────────────────────────────────── */

const LEAGUE = { played: 120, avgGoals: 2.6, over15: 70, over25: 50, fh05: 60, sh05: 70, btts: 50 };

test("an absent provider rate is unmeasured — never coerced to a zero", () => {
  // The live shape: 11 matches played, over-markets present, BTTS fields ABSENT.
  const side = venueStatsFromTeam(
    {
      seasonMatchesPlayed_home: 11,
      seasonOver15Num_home: 8,
      seasonOver15Percentage_home: 73,
      seasonOver25Num_home: 6,
      seasonOver25Percentage_home: 55,
    },
    "home"
  );
  assert.equal(side.btts.measured, false, "absent BTTS must be unmeasured");
  assert.equal(side.fh05.measured, false, "absent FH must be unmeasured");
  assert.equal(side.over15.measured, true, "present figures stay measured");
  // pct-only payloads leave the count fabricated — also unmeasured.
  const pctOnly = venueStatsFromTeam(
    { seasonMatchesPlayed_home: 11, seasonBTTSPercentage_home: 55 },
    "home"
  );
  assert.equal(pctOnly.btts.measured, false, "a pct without its count is not a measured count");
});

test("an unmeasured stat can never yield a scored signal in either direction", () => {
  const side = venueStatsFromTeam(
    { seasonMatchesPlayed_home: 11, seasonOver15Num_home: 8, seasonOver15Percentage_home: 73 },
    "home"
  );
  const report = scoreFixtureSignals({
    homeAtHome: side,
    awayAtAway: null,
    leagueSeason: LEAGUE,
    history: null,
  });
  const all = [report.lead, ...report.supports, ...report.detail].filter(
    (s): s is NonNullable<typeof s> => Boolean(s)
  );
  for (const market of ["btts", "over25", "fh05", "sh05"] as const) {
    assert.equal(
      all.some((s) => s.market === market),
      false,
      `${market} was absent from the payload and must not be scored (either direction)`
    );
  }
  assert.ok(all.some((s) => s.market === "over15"), "the measured market still signals");
});

test("REGRESSION: the live 11-of-11 shut-out lead can no longer mint", () => {
  // Both venues shaped like the live fixtures: real played counts, no BTTS data.
  const mkSide = (played: number) =>
    venueStatsFromTeam(
      {
        [`seasonMatchesPlayed_home`]: played,
        [`seasonOver15Num_home`]: Math.round(played * 0.6),
        [`seasonOver15Percentage_home`]: 60,
      },
      "home"
    );
  const report = scoreFixtureSignals({
    homeAtHome: mkSide(11),
    awayAtAway: mkSide(7),
    leagueSeason: LEAGUE,
    history: null,
  });
  const lead = report.lead;
  assert.ok(
    !lead || lead.market !== "btts",
    `a BTTS lead minted from absent data: ${JSON.stringify(lead)}`
  );
  // And no signal anywhere claims a perfect 0-rate on those samples.
  const all = [report.lead, ...report.supports, ...report.detail].filter(
    (s): s is NonNullable<typeof s> => Boolean(s)
  );
  assert.equal(
    all.some((s) => s.market === "btts" && s.rate === 0),
    false,
    "a fabricated 0-of-N BTTS rate survived"
  );
});

test("a genuinely measured zero is still a finding — the guard blocks absence, not zeros", () => {
  const side = venueStatsFromTeam(
    {
      seasonMatchesPlayed_home: 11,
      seasonBTTSNum_home: 0,
      seasonBTTSPercentage_home: 0,
    },
    "home"
  );
  assert.equal(side.btts.measured, true);
  const report = scoreFixtureSignals({
    homeAtHome: side,
    awayAtAway: null,
    leagueSeason: LEAGUE,
    history: null,
  });
  const all = [report.lead, ...report.supports, ...report.detail].filter(
    (s): s is NonNullable<typeof s> => Boolean(s)
  );
  assert.ok(
    all.some((s) => s.market === "btts" && s.rate === 0 && s.sample === 11),
    "a real 0-of-11 must still be scorable"
  );
});

/* ── 4 · the global 404 ─────────────────────────────────────────────────── */

test("both 404 pages stand on the form-guide ground with dictionary strings", () => {
  for (const file of ["app/not-found.tsx", "app/[locale]/not-found.tsx"]) {
    const src = SRC(file);
    assert.match(src, /rw-hero/, `${file} stands on the form-guide ground`);
    for (const key of ["nfTitle", "nfBody", "nfHome"]) {
      assert.ok(src.includes(`p.${key}`), `${file} wires ${key}`);
    }
    for (const marker of [
      "btn-primary",
      "btn-ghost",
      "text-brand",
      "font-display",
      "text-muted-foreground",
      "rounded-",
      "shadow-",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the nf keys exist translated in every locale set", () => {
  const NF_KEYS = ["nfTitle", "nfBody", "nfHome"];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of NF_KEYS) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
      assert.ok(dict[key].length > 0, `${locale}.${key} empty`);
    }
    if (locale !== "en") {
      assert.notEqual(
        dict.nfBody,
        predictionsEn.nfBody,
        `${locale}.nfBody is the EN string — fallback debt`
      );
    }
  }
});

/* ── the resolver keeps its floor: registry identities intact ───────────── */

test("registry identities keep resolving after the fuzzy tightening", () => {
  for (const slug of ["arsenal", "real-madrid", "flamengo", "kashima-antlers", "lyon"]) {
    const team = getTeam(slug);
    assert.ok(team, `${slug} in registry`);
    const resolved = resolveTeam(listTeams(), { name: team!.name });
    assert.equal(resolved.status, "matched", `${team!.name} must resolve`);
    if (resolved.status === "matched") assert.equal(resolved.team.slug, slug);
  }
});
