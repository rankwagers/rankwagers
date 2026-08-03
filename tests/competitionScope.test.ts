import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { competitionWords, isCup } from "../lib/footystats/client";
import { EXCLUDED_COMPETITIONS } from "../lib/footystats/config";

/**
 * `inScope` publishes the rule identifier `exclude_cup_competitions`. A rule carrying that name
 * must remove cup football and nothing else, or both the number and its stated reason are wrong
 * (§3.2, §3.14).
 *
 * The substring rule it replaced matched `FA` anywhere in a name, so it removed `Faroe Islands
 * Premier League`, `Fase de Ascenso`, `Belfast Premiership` and `Halifax League` — league football,
 * excluded under a cup heading, invisibly, because the rows never reached the archive that would
 * have shown them.
 */

/* ------------------------------------------------------------------ *
 * MUST be excluded — genuine cup football
 * ------------------------------------------------------------------ */

const MUST_EXCLUDE = [
  "FA Cup",
  "EFL Cup",
  "League Cup",
  "Super Cup",
  "UEFA Super Cup",
  "Carabao Cup",
  "DFB-Pokal",
  "DFB Pokal",
  "ÖFB Pokal",
  "Copa del Rey",
  "Copa Libertadores",
  "Copa América",
  "Coppa Italia",
  "Coupe de France",
  "Coupe de la Ligue",
  "Community Shield",
  "Charity Shield",
  "EFL Trophy",
  "Papa John's Trophy",
  "Scottish FA Cup",
  "Championship Play-offs",
  "Serie B Play-offs",
];

test("every genuine cup competition is excluded", () => {
  for (const name of MUST_EXCLUDE) {
    assert.equal(isCup(name), true, `${name} must be excluded`);
  }
});

/* ------------------------------------------------------------------ *
 * MUST NOT be excluded — league football the substring rule removed
 * ------------------------------------------------------------------ */

const MUST_KEEP_FALSE_POSITIVES = [
  // Every one of these was excluded by the substring `FA`.
  "Faroe Islands Premier League",
  "Fase de Ascenso",
  "Fase Final",
  "Fase Regular",
  "Fase de Grupos",
  "Belfast Premiership",
  "Halifax League",
  "Buffalo State League",
  "Alfa Liga",
  "Superfast League",
  "Fanta Liga",
  "Falkirk League",
  "Fatih Karagumruk League",
];

test("no name is excluded merely for containing a keyword's letters", () => {
  for (const name of MUST_KEEP_FALSE_POSITIVES) {
    assert.equal(isCup(name), false, `${name} is league football and must be kept`);
  }
});

test("the false positives were genuinely broken before, not hypothetical", () => {
  // The rule this replaced, reproduced exactly, so the regression cannot silently return.
  const substringRule = (name: string) =>
    EXCLUDED_COMPETITIONS.some((kw) => name.toLowerCase().includes(kw.toLowerCase()));

  for (const name of MUST_KEEP_FALSE_POSITIVES) {
    assert.equal(
      substringRule(name),
      true,
      `${name} should demonstrate the old defect — if it no longer does, this table is stale`
    );
  }
});

/* ------------------------------------------------------------------ *
 * Every real competition name in the archives stays in scope
 * ------------------------------------------------------------------ */

function archivedCompetitionNames(): string[] {
  const dir = path.join(process.cwd(), "data", "daily-archives");
  const names = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const archive = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Record<
      string,
      Array<{ competition?: string }>
    >;
    for (const key of ["fh", "over15", "over25", "sh"]) {
      for (const row of archive[key] ?? []) {
        const name = (row.competition ?? "").trim();
        if (name) names.add(name);
      }
    }
  }
  return [...names].sort();
}

test("no competition that survived the old rule is newly excluded", () => {
  // Every archived name already passed the substring rule. The fix widens what is kept, so it must
  // never narrow it: a name that used to reach the lists and now does not would be a regression
  // that silently rewrites stored history.
  const names = archivedCompetitionNames();
  assert.ok(names.length >= 50, `expected a real corpus, found ${names.length}`);

  const newlyExcluded = names.filter((name) => isCup(name));
  assert.deepEqual(newlyExcluded, [], "these names would be lost from the lists and the archive");
});

test("accented competition names survive tokenisation intact", () => {
  // The feed carries these. Splitting on ASCII alone would tear them into fragments.
  for (const name of [
    "Kolmonen Etelä",
    "Ykkönen",
    "Úrvalsdeild",
    "Primera División",
    "Division 2 Norra Götaland",
  ]) {
    assert.equal(isCup(name), false, `${name} must be kept`);
    assert.ok(competitionWords(name).length >= 1, `${name} must tokenise`);
  }
});

/* ------------------------------------------------------------------ *
 * The matcher itself
 * ------------------------------------------------------------------ */

test("spaces and hyphens both separate words", () => {
  assert.deepEqual(competitionWords("DFB-Pokal"), ["dfb", "pokal"]);
  assert.deepEqual(competitionWords("FA Cup"), ["fa", "cup"]);
  assert.deepEqual(competitionWords("Faroe Islands Premier League"), [
    "faroe",
    "islands",
    "premier",
    "league",
  ]);
});

test("a multi-word keyword needs every word, contiguously", () => {
  assert.equal(isCup("Championship Play-offs"), true);
  assert.equal(isCup("Play-offs"), true);
  // `play` alone is not the keyword.
  assert.equal(isCup("Fair Play League"), false);
  assert.equal(isCup("Offshore League"), false);
});

test("the removed keywords were strictly redundant", () => {
  // Any name containing `League Cup` or `Super Cup` also contains the word `Cup`, which is listed.
  // Asserted rather than assumed, so dropping them cannot have changed what is excluded.
  assert.equal(EXCLUDED_COMPETITIONS.includes("League Cup"), false);
  assert.equal(EXCLUDED_COMPETITIONS.includes("Super Cup"), false);
  for (const name of ["League Cup", "Super Cup", "EFL League Cup", "Spanish Super Cup"]) {
    assert.equal(isCup(name), true, `${name} must still be excluded by the word Cup`);
  }
});

test("an empty or punctuation-only name is not a cup", () => {
  for (const name of ["", "   ", "---", "//"]) {
    assert.equal(isCup(name), false);
  }
});
