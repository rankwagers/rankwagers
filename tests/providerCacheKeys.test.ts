import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * PROVIDER CACHE KEYS.
 *
 * A cache key defect is invisible: nothing fails, nothing logs, the page renders correctly, and
 * the only symptom is the provider bill. `getMatchDetail`'s key carried `locale`, so one fixture
 * read across thirty-two locales cost thirty-two identical upstream fetches of the same football.
 *
 * These tests hold the shape of the keys rather than the behaviour of the cache, because that is
 * where the defect lives and because the cost is not observable from a unit test.
 *
 * THE RULE. A key component belongs in a provider cache key only if changing it changes the
 * UPSTREAM RESPONSE. `locale` does not — every locale's analysis text arrives in the same payload
 * and is selected afterwards. Presentation belongs after the cache, never in its key.
 */

const SRC = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const MATCH_DETAIL = SRC("lib/footystats/matchDetail.ts");
const ODDS = SRC("lib/api-football/odds.ts");
const CLIENT = SRC("lib/footystats/client.ts");

/** Every `unstable_cache(...)` key array in a source file, as raw text. */
function cacheKeys(src: string): string[] {
  return [...src.matchAll(/unstable_cache\([\s\S]*?\[([\s\S]*?)\]/g)].map((m) =>
    m[1]
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/* ------------------------------------------------------------------ *
 * No provider cache key carries a locale
 * ------------------------------------------------------------------ */

test("no unstable_cache key in the provider layer carries locale", () => {
  for (const [name, src] of [
    ["matchDetail.ts", MATCH_DETAIL],
    ["odds.ts", ODDS],
    ["client.ts", CLIENT],
  ] as const) {
    const keys = cacheKeys(src);
    assert.ok(keys.length > 0, `precondition: ${name} still has cache keys to check`);
    for (const key of keys) {
      assert.equal(
        /\blocale\b/.test(key),
        false,
        `${name} caches on a locale — one fixture would cost one fetch per language: [${key}]`
      );
    }
  }
});

test("the match-detail key is the fixture and nothing else", () => {
  const keys = cacheKeys(MATCH_DETAIL);
  const detail = keys.find((k) => k.includes("footystats-match-detail"));
  assert.ok(detail, "precondition: the match-detail cache still exists");

  // Exactly two components: the namespace and the fixture id. `competition` and `country` are
  // attributes OF the fixture — derivable from matchId — so keying on them split one fixture's
  // cache without ever splitting its data.
  assert.match(detail, /^"footystats-match-detail-core", String\(matchId\)$/);
});

test("the live-context key is the fixture and nothing else", () => {
  // Audited alongside match-detail. This one was already clean; the test keeps it that way.
  const keys = cacheKeys(MATCH_DETAIL);
  const live = keys.find((k) => k.includes("footystats-match-live"));
  assert.ok(live, "precondition: the live cache still exists");
  assert.match(live, /^"footystats-match-live", String\(matchId\)$/);
});

test("the daily-lists key is the date and nothing else", () => {
  for (const key of cacheKeys(CLIENT).filter((k) => k.includes("footystats-daily"))) {
    assert.match(key, /^"footystats-daily", d$/);
  }
});

/* ------------------------------------------------------------------ *
 * A key component that CHANGES the upstream response must be present
 * ------------------------------------------------------------------ */

test("the odds key carries every input the odds lookup actually uses", () => {
  // The inverse defect. `fetchFixtureOdds` scores candidate fixtures on league name and country
  // and hard-rejects on an unmatched country, so a context-free caller resolves a different
  // fixture. Omitting them from the key served one caller's looser match to another.
  const odds = cacheKeys(ODDS).find((k) => k.includes("api-football-fixture-odds"));
  assert.ok(odds, "precondition: the odds cache still exists");

  for (const component of ["target.home", "target.away", "target.kickoffAt", "target.competition", "target.country"]) {
    assert.ok(odds.includes(component), `the odds key omits ${component}: [${odds}]`);
  }
});

/* ------------------------------------------------------------------ *
 * Locale selection happens after the cache, not inside it
 * ------------------------------------------------------------------ */

test("the cached core holds the provider's multilingual block, not one rendered locale", () => {
  // This is what makes one cache entry serve every locale: the payload keeps all languages and
  // the reader's one is chosen on the way out.
  assert.match(MATCH_DETAIL, /gptSource:\s*\{\s*en\?:\s*string;\s*int\?:\s*Record<string,\s*string>\s*\}/);
  assert.match(MATCH_DETAIL, /function gptTextFromSource\(/);
});

test("the cached core carries no locale-dependent field", () => {
  const core = /type MatchDetailCore = ([\s\S]*?)\n\};/.exec(MATCH_DETAIL);
  assert.ok(core, "precondition: MatchDetailCore is still declared");
  // `ai` is the rendered analysis for ONE reader. It must be composed after the cache, which is
  // why the core omits it from the public shape.
  assert.match(core[1], /Omit<MatchDetailPublic, "ai" \| "odds">/);
});

/* ------------------------------------------------------------------ *
 * The fixture route states why it is dynamic
 * ------------------------------------------------------------------ */

test("the fixture page does not declare a revalidate that force-dynamic overrides", () => {
  const page = SRC("app/[locale]/fixtures/[matchId]/page.tsx");
  const stripped = page.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(stripped, /export const dynamic = "force-dynamic"/);
  assert.equal(
    /export const revalidate/.test(stripped),
    false,
    "a revalidate beside force-dynamic is inert and reads as caching that does not happen"
  );
});
