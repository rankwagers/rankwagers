import type { PredictionStrings } from "./predictionsEn";
import { predictionsEn } from "./predictionsEn";

/**
 * Locale strings over the English base.
 *
 * INTERIM DECISION, STATED HERE BECAUSE THIS IS WHERE IT HAPPENS: a key a locale does not
 * translate falls back to the ENGLISH string, silently. No marker, no log, no missing-key error —
 * the page simply prints English inside the locale. That is a deliberate trade (a missing key
 * would be a type error; a missing translation is a visible, bounded gap) and it is also how a
 * defect ships: every NEW dictionary key renders untranslated in all thirty locales until each
 * locale file catches up, and nothing fails to say so.
 *
 * The debt is worked off locale-by-locale — NL carries the new homepage keys now; the other
 * locales are fixture-pass debt. Any replacement (visible markers, build-time coverage reports,
 * per-key fallback lists) supersedes this comment.
 */
export function mergePredictions(
  overrides: Partial<PredictionStrings>
): PredictionStrings {
  return { ...predictionsEn, ...overrides };
}
