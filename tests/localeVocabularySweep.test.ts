import assert from "node:assert/strict";
import test from "node:test";

import { predictionsByLocale } from "../lib/translations/predictionsLocales";

/**
 * THE BANNED-VOCABULARY SWEEP: "tip"/"tips" across every locale's live/ranked keys.
 *
 * The live desk's own copy says these are observations, not tips — and the NL strings sold a
 * "gratis tip per uur" against it. NL was fixed with vocabulary-safe Dutch; this sweep walks ALL
 * locale dictionaries' live* and ranked* keys so the word cannot ship unnoticed again.
 *
 * THE DEBT BELOW IS A REPORT, NOT AN EXEMPTION LIST TO GROW. Six locales still carry the
 * word (the Europe file was cleaned whole in the fixture pass); they are recorded verbatim from the sweep that found them, and the honest fix is
 * register-appropriate wording per language — the fixture pass's job, not a mass edit here.
 * A key fixed in a locale must leave the map (staleness fails); a key ADDED anywhere fails
 * outright. English and Dutch are pinned clean.
 */

/** Word-boundary "tip"/"tips" across scripts: a letter on either side does not count. */
const TIP = /(^|[^\p{L}])tips?([^\p{L}]|$)/iu;

/*
 * ZERO, AND PINNED THERE (language sweep, 2026-08-13). The final six locales
 * (es, es-es, fr, it, vi, id — five live-desk keys each) moved to the
 * observation register, and this ceiling now works like SOURCE_CLAIM and
 * KNOWN_CLAIM before it: any entry appearing here again is banned vocabulary
 * entering a dictionary — fix the copy, never extend the register.
 */
const TIP_DEBT: Record<string, readonly string[]> = {};

function sweep(): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (const [locale, strings] of Object.entries(predictionsByLocale)) {
    for (const [key, value] of Object.entries(strings)) {
      if (!/^(live|ranked)/.test(key)) continue;
      if (typeof value === "string" && TIP.test(value)) {
        hits.set(locale, [...(hits.get(locale) ?? []), key]);
      }
    }
  }
  return hits;
}

test("EN and NL live/ranked copy carries no tip vocabulary", () => {
  const hits = sweep();
  assert.deepEqual(hits.get("en") ?? [], [], "English sells observations, not tips");
  assert.deepEqual(
    hits.get("nl") ?? [],
    [],
    "the Dutch live desk was made vocabulary-safe — it stays that way"
  );
});

test("the tip debt matches the sweep exactly: nothing new, nothing stale", () => {
  const hits = sweep();
  const found: Record<string, string[]> = {};
  for (const [locale, keys] of hits) {
    if (locale === "en" || locale === "nl") continue; // pinned clean above
    found[locale] = keys.sort();
  }
  const recorded: Record<string, string[]> = {};
  for (const [locale, keys] of Object.entries(TIP_DEBT)) recorded[locale] = [...keys].sort();

  assert.deepEqual(
    found,
    recorded,
    "the sweep and the recorded debt disagree. A NEW hit means banned vocabulary entered a " +
      "dictionary — fix the copy, do not extend TIP_DEBT. A MISSING hit means a locale was " +
      "fixed — shrink TIP_DEBT so the ceiling falls with it."
  );
});
