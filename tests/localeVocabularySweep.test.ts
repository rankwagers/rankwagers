/**
 * DECIDED (v3 reskin, session 1, 2026-09-09): the tip-vocabulary ban is
 * RETIRED. Bible V3 (docs/design/bible-v3.md, Compliance) repositions the
 * product as an affiliate-first predictions site whose primary nav literally
 * says "Betting Tips" — "tips", "free bets", "bonuses" and "offers" are now
 * allowed vocabulary in every register, so a sweep that fails the build on
 * the word "tip" enforces a law that no longer exists.
 *
 * What this file used to do: walk every locale's `live` and `ranked` keys for
 * word-boundary "tip(s)" and pin the debt map at zero (it reached zero in
 * the 2026-08-13 language sweep, so nothing was grandfathered out by this
 * retirement — the register was clean when the law changed).
 *
 * What still stands, unchanged, elsewhere: the claim-integrity scans
 * (BANNED_CLAIMS / findClaimViolations in lib/trust/claims.ts and the
 * banned-claim sweeps in tests/accaStrings.test.ts — "guaranteed",
 * "sure win", "can't lose" remain banned), and the label scans. Retiring
 * the vocabulary ban does not loosen a single truth law.
 *
 * Do not re-open without a positioning change as explicit as the one that
 * closed it.
 */
