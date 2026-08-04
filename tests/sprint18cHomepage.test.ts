import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyticsEventNames } from "../lib/analytics/types";
import { resolveFeaturedLeagues } from "../lib/homepage/trustPerformance";
import { predictionsEn } from "../lib/translations/predictionsEn";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("homepage copy answers product, trust, and next-step questions", () => {
  // The hero states a practice, not a quality: what the product does to a market, and when.
  // Keyed on the method verbs rather than on one approved sentence, so the copy can be revised
  // without the test having to be rewritten alongside it.
  assert.match(predictionsEn.heroTitle, /assessed|recorded|settled|measured/i);
  // The subtitle carries the differentiator: predictions are recorded before the event and scored
  // after it, losses included. A subtitle that drops the losing half is the affiliate framing.
  assert.match(predictionsEn.heroSubtitle, /record|scored|result|settle/i);
  assert.match(predictionsEn.heroSubtitle, /lose|lost|loss/i);
  assert.doesNotMatch(predictionsEn.heroSubtitle, /guaranteed|sure tip|lock this in/i);
  // Editorial standard §2.4: no superlative or self-assurance in the two strings a visitor reads
  // first. A publication that calls itself independent is asking to be believed.
  for (const copy of [predictionsEn.heroTitle, predictionsEn.heroSubtitle]) {
    assert.doesNotMatch(copy, /\b(best|top|leading|expert|hand-picked|exclusive)\b/i);
    assert.doesNotMatch(copy, /\b(independent|honest|transparent|trusted|unbiased)\b/i);
  }
  // Tier 1 of the trust hierarchy: how the money is made, and no promise about its own effect.
  assert.match(predictionsEn.heroDisclosure, /commission/i);
  assert.doesNotMatch(predictionsEn.heroDisclosure, /does not affect|independent/i);
  // The dateline is a template, not a hardcoded date.
  assert.match(predictionsEn.heroAssessed, /\{date\}/);
  assert.ok(predictionsEn.verifiedTitle);
  assert.ok(predictionsEn.verifiedWon);
  assert.ok(predictionsEn.verifiedLost);
  assert.ok(predictionsEn.recentTitle);
  assert.ok(predictionsEn.archiveTitle);
  assert.match(predictionsEn.metaDescription, /transparent|evidence/i);
});

test("featured leagues resolve registry links for major competitions", () => {
  const leagues = resolveFeaturedLeagues(
    {
      country: "GB",
      language: "en",
      currency: "GBP",
      timezone: "Europe/London",
      source: "unknown",
      topLeagues: ["Premier League", "La Liga"],
      supportedPartners: [],
    },
    "en"
  );
  assert.ok(leagues.some((row) => row.href?.includes("/competitions/premier-league")));
  assert.ok(leagues.some((row) => row.href?.includes("/competitions/la-liga")));
});

test("homepage composition includes narrative sections and Acca add controls", () => {
  const home = readFileSync(
    path.join(root, "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  for (const token of [
    /*
     * Sprint 1 moved the hero into `components/homepage/hero`. The page still owns the anchor —
     * it passes the id down — and the assertion that the id is actually APPLIED to the H1 now
     * sits against the hero component below, where the element lives.
     */
    "HomepageHero",
    'headingId="homepage-hero-heading"',
    'id="top-picks"',
    'id="verified-performance"',
    'id="recent-results"',
    /*
     * `id="featured-leagues"` is deliberately absent. The row it anchored rendered
     * `trust.featuredLeagues`, which falls back to a hardcoded top-five European list — none of
     * it on the board the page actually researched. Deleted in the Pass 2 conversion; see the
     * note at its former site in RankWagersHome.
     */
    'id="why-trust"',
    'id="prediction-archive"',
    "HomepageSearchEntry",
    "HomepageAccaEntry",
    /*
     * `rankedAddAcca`, not `topPicksAddAcca`. The ranked section took the map's vocabulary in
     * Pass 2 — "Highest provider potential today" — on new keys rather than by re-pointing
     * translated ones. What this token guards is unchanged: the add-to-acca control is fed a
     * label from the dictionary rather than a string written at the call site.
     */
    "rankedAddAcca",
    "AddToAccaButton",
  ]) {
    assert.match(home, new RegExp(token));
  }
  assert.doesNotMatch(home, /ComboHomepageLauncher/);
  assert.doesNotMatch(home, /guaranteed wins/i);
});

test("hero applies the page's heading anchor to its H1", () => {
  const stage = readFileSync(
    path.join(root, "components/homepage/hero/HeroStage.tsx"),
    "utf8"
  );
  // The H1 must carry the id the page passes down, or `aria-labelledby` points at nothing.
  assert.match(stage, /<h1\s+id=\{headingId\}/);
  assert.match(stage, /aria-labelledby=\{headingId\}/);
});

test("hero never ships a synthetic reading", () => {
  const model = readFileSync(path.join(root, "lib/homepage/heroModel.ts"), "utf8");
  // Sprint 1 contract: a field is either sourced from the provider lists or null. Any default
  // for these would put an unevidenced figure on the page.
  for (const field of [
    "evidence",
    "confidence",
    "confidenceLabel",
    "reasons",
    "summary",
    "signals",
    "history",
  ]) {
    assert.match(model, new RegExp(`${field}: null,`));
  }
  assert.match(model, /published: null,/);

  /*
   * `analysed` is no longer a hardcoded null: the qualification pipeline now observes the
   * population at the one point where the rejected rows still exist, and hands it over on
   * `ResearchRun`. The guard therefore moves from "this field is always null" to the rule that
   * actually matters — a stage is the run's observation or null, and never a substitute.
   */
  assert.match(model, /analysed: run\?\.analysed \?\? null,/);
  assert.match(model, /validated: run\?\.validated \?\? null,/);
  assert.match(model, /inScope: run\?\.inScope \?\? null,/);

  // No stage may fall back to a number, and none may be reconstructed by arithmetic.
  for (const stage of ["analysed", "validated", "inScope", "qualified", "featured"]) {
    assert.doesNotMatch(
      model,
      new RegExp(`${stage}:[^,\\n]*\\?\\?\\s*\\d`),
      `${stage} must never default to a number`
    );
  }
  assert.doesNotMatch(
    model,
    /(analysed|validated|inScope|qualified)\s*-\s*(analysed|validated|inScope|qualified|run)/,
    "no funnel stage may be derived by subtracting another"
  );
});

test("homepage page loads trust model server-side", () => {
  const page = readFileSync(path.join(root, "app/[locale]/page.tsx"), "utf8");
  assert.match(page, /buildHomepageTrustModel/);
  assert.match(page, /pageMetadata/);
  assert.match(page, /trust=\{trust\}/);
});

test("footer exposes explore + trust internal links", () => {
  const footer = readFileSync(path.join(root, "components/Footer.tsx"), "utf8");
  assert.match(footer, /\/competitions/);
  assert.match(footer, /\/markets/);
  assert.match(footer, /\/operators/);
  assert.match(footer, /\/methodology/);
  assert.match(footer, /\/archive/);
  assert.match(footer, /responsible-gambling/);
});

test("operator strip stays editorial without banner promo assets", () => {
  const strip = readFileSync(
    path.join(root, "components/bible/BibleOperatorStrip.tsx"),
    "utf8"
  );
  assert.doesNotMatch(strip, /sidebar-1xbet/);
  assert.doesNotMatch(strip, /shadow-glow/);
  assert.match(strip, /Editorial options/);
  assert.match(strip, /rel=["']noopener sponsored["']/);
});

test("homepage analytics events and section ids are registered", () => {
  assert.ok(analyticsEventNames.includes("homepage_viewed"));
  assert.ok(analyticsEventNames.includes("homepage_section_impression"));
  const engagement = readFileSync(
    path.join(root, "lib/analytics/engagement.ts"),
    "utf8"
  );
  assert.match(engagement, /verified_performance/);
  assert.match(engagement, /recent_results/);
  assert.match(engagement, /prediction_archive/);
  assert.match(engagement, /acca_entry/);
});

test("trust performance module documents honest metric boundaries", () => {
  const src = readFileSync(
    path.join(root, "lib/homepage/trustPerformance.ts"),
    "utf8"
  );
  assert.match(src, /Never invents ROI/);
  assert.match(src, /readDailyArchive/);
  assert.match(src, /hitRatePct/);
});
