import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ODDS_ARE_POINT_IN_TIME,
  extractUserFacingText,
  findClaimViolations,
  hasUnqualifiedRanking,
} from "../lib/trust/claims";

/**
 * Sprint 30 — odds provenance and site-wide ranking coverage.
 *
 * Closes two gaps left open by Sprints 27–29:
 *
 *  1. `ODDS_ARE_POINT_IN_TIME` existed in the shared vocabulary but was rendered nowhere outside
 *     the Sprint 20B-B Acca pages, so every older surface showed prices with no provenance.
 *  2. `hasUnqualifiedRanking` was enforced on exactly one page, leaving `/operators`,
 *     `/compare/*`, `/best-betting-sites` and `/bonuses` free to reintroduce the very claim
 *     Sprint 27 removed.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

/**
 * Sprint 30: uses the SHARED extractor, which covers JSX text as well as string literals. The
 * local literal-only copy this replaced is exactly why the odds panel's JSX prose went unscanned.
 */
const userFacingStrings = extractUserFacingText;
/* ================================================================== *
 * 1. Odds provenance
 * ================================================================== */

const ODDS_PANEL = "components/odds/OddsIntelligencePanel.tsx";

test("REGRESSION: the odds panel discloses that prices are point-in-time", () => {
  const src = read(ODDS_PANEL);
  assert.match(src, /ODDS_ARE_POINT_IN_TIME/, "the disclosure must be rendered");
  assert.match(src, /from "@\/lib\/trust\/claims"/, "it must come from the shared vocabulary");
  // Not pasted: a copy would drift from the Acca surfaces carrying the same promise.
  assert.equal(
    /recorded when this page was generated/.test(codeOnly(src)),
    false,
    "the disclosure text must not be duplicated into the component",
  );
});

test("REGRESSION: the disclosure sits in the header, before any price is listed", () => {
  const src = read(ODDS_PANEL);
  const disclosureAt = src.indexOf("ODDS_ARE_POINT_IN_TIME", src.indexOf("return ("));
  const firstPriceAt = src.indexOf("toFixed(2)");
  assert.ok(disclosureAt > 0, "the disclosure must be inside the rendered tree");
  assert.ok(
    disclosureAt < firstPriceAt,
    "a reader must meet the provenance before the first price",
  );
});

test("the disclosure states both halves: when recorded, and that it may be gone", () => {
  assert.match(ODDS_ARE_POINT_IN_TIME, /recorded/i);
  assert.match(ODDS_ARE_POINT_IN_TIME, /may have changed|no longer/i);
  assert.deepEqual(findClaimViolations(ODDS_ARE_POINT_IN_TIME), []);
});

test("the odds panel makes no claim the data cannot support", () => {
  const copy = userFacingStrings(read(ODDS_PANEL));
  assert.deepEqual(findClaimViolations(copy), []);
  assert.equal(hasUnqualifiedRanking(copy), false);
  // It describes itself as observation, not prediction.
  assert.match(copy, /observed market history only/);
});

/* ================================================================== *
 * 2. Site-wide ranking coverage
 * ================================================================== */

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Every surface that presents commercial operators. Named explicitly rather than globbed, so
 * adding a comparison page is a deliberate act that must also decide how it discloses its
 * ordering — a glob would silently absorb a new page and prove nothing about it.
 */
const COMPARISON_SURFACES = [
  /*
   * Post-collapse: the retired door pages remain listed (they exist as
   * permanent redirects and must stay claim-free); the deleted legacy
   * components leave the list with the commercial conversion.
   */
  "app/[locale]/best-betting-sites/page.tsx",
  "app/[locale]/best-crypto-betting-sites/page.tsx",
  "app/[locale]/bonuses/page.tsx",
  "app/[locale]/operators/page.tsx",
  "app/[locale]/compare/[slug]/page.tsx",
  "app/[locale]/reviews/[brand]/page.tsx",
];

test("every comparison surface exists and is covered by this check", () => {
  for (const rel of COMPARISON_SURFACES) {
    assert.doesNotThrow(() => read(rel), `${rel} must exist — update the list if a page moved`);
  }
  assert.ok(COMPARISON_SURFACES.length >= 6);
});

test("no comparison surface asserts an unqualified ranking", () => {
  const failures: string[] = [];
  for (const rel of COMPARISON_SURFACES) {
    const copy = userFacingStrings(read(rel));
    if (hasUnqualifiedRanking(copy)) failures.push(rel);
  }
  assert.deepEqual(
    failures,
    [],
    `unqualified ranking claims found on:\n${failures.join("\n")}`,
  );
});

test("no comparison surface contains a banned claim", () => {
  const failures: string[] = [];
  for (const rel of COMPARISON_SURFACES) {
    for (const v of findClaimViolations(userFacingStrings(read(rel)))) {
      failures.push(`${rel}: "${v.match}" — ${v.reason}`);
    }
  }
  assert.deepEqual(failures, [], `claim violations:\n${failures.join("\n")}`);
});

test("the ranking detector is real: it would catch a superlative with no basis", () => {
  // A negative-only sweep could pass because the detector is broken.
  assert.equal(hasUnqualifiedRanking("Our top-rated bookmaker this month"), true);
  assert.equal(hasUnqualifiedRanking("The best site for accumulators"), true);
  assert.equal(hasUnqualifiedRanking("The #1 site for crypto"), true);
  // And that naming a basis is what qualifies it.
  assert.equal(
    hasUnqualifiedRanking("Our top-rated bookmaker, ranked by our published methodology"),
    false,
  );
});

/* ================================================================== *
 * 3. The whole public corpus still shows odds honestly
 * ================================================================== */

test("no public surface presents a price as an offer", () => {
  const surfaces = [
    ...walk(path.join(root, "components", "odds")),
    ...walk(path.join(root, "components", "acca-publication")),
  ];
  assert.ok(surfaces.length >= 5, `expected odds surfaces, found ${surfaces.length}`);
  for (const file of surfaces) {
    const copy = userFacingStrings(readFileSync(file, "utf8"));
    const rel = file.replace(root + path.sep, "").replace(/\\/g, "/");
    assert.deepEqual(findClaimViolations(copy), [], rel);
    for (const forbidden of [/\bbest odds\b/i, /\bguaranteed odds\b/i, /\bbeat the bookie\b/i]) {
      assert.equal(forbidden.test(copy), false, `${rel} must not contain ${forbidden}`);
    }
  }
});

test("both odds-bearing surface families carry a provenance disclosure", () => {
  // The Acca pages have carried one since Sprint 20B-B; the odds panel now does too. Neither
  // may lose it without this failing.
  assert.match(
    read("components/acca-publication/PublicAccaDetailView.tsx"),
    /CAPTURED_ODDS_NOTE/,
  );
  assert.match(read(ODDS_PANEL), /ODDS_ARE_POINT_IN_TIME/);
});
