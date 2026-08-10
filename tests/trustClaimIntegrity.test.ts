import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BANNED_CLAIMS,
  LIVE_SIGNALS_FRAMING,
  OPERATOR_COMPARISON_BASIS,
  findClaimViolations,
  hasUnqualifiedRanking,
} from "../lib/trust/claims";

/**
 * Sprint 27 — site-wide claim integrity.
 *
 * The Product Manifesto forbids fake confidence, guarantees, "AI says" and editorial hype. Until
 * this suite that rule was enforced only on the Sprint 20B-B Acca surfaces; every older page was
 * governed by prose in a backlog document, which is why two violations (P1-09, P1-10) survived
 * several sprints.
 *
 * This scans the ACTUAL user-facing copy — every translation dictionary and every public
 * component and page — so a regression fails here instead of waiting for the next audit.
 */

const root = process.cwd();

/* ------------------------------------------------------------------ *
 * Corpus
 * ------------------------------------------------------------------ */

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

/** Strip comments: engineering prose is not user-facing copy and must not be scanned. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * Extract only string literals. Identifiers, types and imports are not shown to a reader —
 * scanning them would produce noise that forces the assertions to be loosened, which is how a
 * guard like this dies.
 */
function userFacingStrings(src: string): string {
  const code = codeOnly(src);
  const literals: string[] = [];
  const rx = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(code)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? "";
    // Skip import specifiers, class names and other machine strings.
    if (/^[@./]/.test(value)) continue;
    if (/^[a-z0-9-]+(\s+[a-z0-9:[\]/.-]+)+$/i.test(value) && /(?:^|\s)(?:flex|text-|bg-|border|rounded|px-|py-|mt-|mb-|grid)/.test(value)) continue;
    literals.push(value);
  }
  return literals.join("\n");
}

const DICTIONARIES = walk(path.join(root, "lib", "translations"));
const PUBLIC_COMPONENTS = walk(path.join(root, "components")).filter(
  (f) => !/[\\/](admin-|developer|builder-approval)/.test(f),
);
const PUBLIC_PAGES = walk(path.join(root, "app", "[locale]"));

const CORPUS = [...DICTIONARIES, ...PUBLIC_COMPONENTS, ...PUBLIC_PAGES];

const rel = (f: string) => f.replace(root + path.sep, "").replace(/\\/g, "/");

/* ================================================================== *
 * 1. The corpus is real
 * ================================================================== */

test("the scan actually covers the product's user-facing copy", () => {
  assert.ok(DICTIONARIES.length >= 5, `expected translation files, found ${DICTIONARIES.length}`);
  assert.ok(
    PUBLIC_COMPONENTS.length >= 50,
    `expected public components, found ${PUBLIC_COMPONENTS.length}`,
  );
  assert.ok(PUBLIC_PAGES.length >= 20, `expected public pages, found ${PUBLIC_PAGES.length}`);
  // A guard that scans nothing passes trivially; this is the tripwire against that.
  assert.ok(CORPUS.length >= 100, `corpus too small to be meaningful: ${CORPUS.length}`);
});

/* ================================================================== *
 * 2. No banned claim anywhere in user-facing copy
 * ================================================================== */

/**
 * Sprint 35 — source-level claim debt.
 *
 * Widening the tip-as-product and superlative patterns surfaced violations that had always been
 * shipping but that no pattern could previously read. The English ones were fixed in that sprint.
 * These nine hits are the nl/cs/da/el renderings of that same copy, all of them the embedded
 * English loanword "live tip".
 *
 * They are recorded rather than rewritten because the only honest fix is register-appropriate
 * wording in four languages that cannot be verified here, and fabricated copy in a trust product
 * is a worse outcome than debt that is counted, named and capped. The identical list is mirrored
 * in `claimPatternWidening.test.ts`, which pins the exact shipped strings and asserts that the
 * guard still rejects every one of them.
 *
 * This is a ceiling, never an exemption: the guard is unchanged, the match must be exactly the
 * expected one in exactly the expected file, and the count may only fall.
 */
const SOURCE_CLAIM_DEBT = {
  file: "lib/translations/predictionsLocalesEurope.ts",
  match: /^live\s+tip$/i,
  // 9 recorded in Sprint 35 → 7 after the NL fix → 0: the fixture pass moved the cs/da/el
  // (and sv/no/ro) live-desk strings to the research register. The count may only fall.
  count: 0,
} as const;

test("no user-facing string promises an outcome, asserts certainty or claims profit", () => {
  const failures: string[] = [];
  const deferred: string[] = [];
  for (const file of CORPUS) {
    const violations = findClaimViolations(userFacingStrings(readFileSync(file, "utf8")));
    for (const v of violations) {
      const entry = `${rel(file)}: "${v.match}" — ${v.reason}`;
      const isDebt =
        rel(file) === SOURCE_CLAIM_DEBT.file && SOURCE_CLAIM_DEBT.match.test(v.match.trim());
      if (isDebt) deferred.push(entry);
      else failures.push(entry);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `claim-integrity violations found:\n${failures.join("\n")}\n\n` +
      "Fix the copy. Do not extend SOURCE_CLAIM_DEBT to obtain a green run.",
  );
  assert.ok(
    deferred.length <= SOURCE_CLAIM_DEBT.count,
    `recorded claim debt grew from ${SOURCE_CLAIM_DEBT.count} to ${deferred.length}; ` +
      `it may only shrink:\n${deferred.join("\n")}`,
  );
});

test("the recorded source debt is real, and the guard still rejects every entry", () => {
  /*
   * Without this the ceiling could be held open by entries that no longer exist, quietly creating
   * room for new violations to slip in under the same cap.
   */
  const found = findClaimViolations(
    userFacingStrings(readFileSync(path.join(root, SOURCE_CLAIM_DEBT.file), "utf8")),
  ).filter((v) => SOURCE_CLAIM_DEBT.match.test(v.match.trim()));

  assert.equal(
    found.length,
    SOURCE_CLAIM_DEBT.count,
    "the recorded debt must match what the file actually ships — update the count when copy is fixed",
  );
  for (const v of found) {
    assert.ok(
      findClaimViolations(v.match).length > 0,
      `${v.match} must still be rejected by the guard on its own terms`,
    );
  }
});

test("the detector is real: it catches the phrasings the manifesto names", () => {
  // A negative-only test could pass because the detector is broken. These prove it fires.
  const mustCatch = [
    "Guaranteed win every week",
    "This is a sure thing",
    "You can't lose with this",
    "100% accurate predictions",
    "Risk-free bet for new users",
    "Insider tip from our sources",
    "AI predicts a home victory",
    "Today's banker",
    "Free betting tips daily",
    "Double your money tonight",
  ];
  for (const phrase of mustCatch) {
    assert.ok(
      findClaimViolations(phrase).length > 0,
      `the detector must catch: "${phrase}"`,
    );
  }
});

test("honest denials are not flagged as their opposite", () => {
  // The product already relies on this phrasing; a guard that banned it would push authors
  // toward saying nothing, which is worse than saying "not a guarantee".
  const mustAllow = [
    "Model probability for this market — statistical indicator, not a guarantee.",
    "Odds may change. No guaranteed returns.",
    "Risk labels are not guarantees.",
    "Confidence is not a guarantee of any outcome.",
  ];
  for (const phrase of mustAllow) {
    assert.deepEqual(
      findClaimViolations(phrase),
      [],
      `honest denial must be allowed: "${phrase}"`,
    );
  }
});

test("the banned vocabulary covers every category the manifesto names", () => {
  const reasons = new Set(BANNED_CLAIMS.map((c) => c.reason));
  for (const required of [
    "promises an outcome",
    "asserts certainty",
    "attributes authority to a model",
    "positions the product as a tipster",
  ]) {
    assert.ok(reasons.has(required), `missing banned-claim category: ${required}`);
  }
});

/* ================================================================== *
 * 3. P1-09 — the crypto FAQ overclaim
 * ================================================================== */

const CRYPTO_PAGE = "app/[locale]/best-crypto-betting-sites/page.tsx";

test("REGRESSION P1-09: the crypto FAQ overclaim cannot return — the page is retired", () => {
  /*
   * Re-pinned after the commercial conversion pass. The three original P1-09
   * pins guarded the corrected FAQ answers on this page; the page is now a
   * permanent redirect into /operators, so the strongest form of the fix
   * holds: there is no user-facing copy here at all. What must never return
   * is the page itself with claims in it.
   */
  const src = readFileSync(path.join(root, CRYPTO_PAGE), "utf8");
  assert.match(src, /permanentRedirect/);
  assert.match(src, /RETIRED/);
  assert.equal(/FAQPage/.test(src), false, "no structured-data claims on a redirect");
  assert.equal(
    /Our top-rated crypto betting site this month is/.test(src),
    false,
    "the unattributed 'top-rated' assertion must not return",
  );
  assert.equal(
    findClaimViolations(userFacingStrings(src)).length,
    0,
    "a redirect page carries no user-facing claims",
  );
});

/* ================================================================== *
 * 4. P1-10 — Live Signals tipster framing
 * ================================================================== */

const LIVE_PANEL = "components/predictions/LiveFeedPanel.tsx";

test("REGRESSION P1-10: the Live Signals feed states what it is and is not", () => {
  const src = readFileSync(path.join(root, LIVE_PANEL), "utf8");
  assert.match(src, /LIVE_SIGNALS_FRAMING/, "the framing must be rendered");
  assert.match(src, /from "@\/lib\/trust\/claims"/, "it must come from the shared vocabulary");

  // The framing itself must do the two jobs: say what a signal is, and deny the tip reading.
  assert.match(LIVE_SIGNALS_FRAMING, /Not tips/i);
  assert.match(LIVE_SIGNALS_FRAMING, /not advice/i);
  assert.match(LIVE_SIGNALS_FRAMING, /decide for yourself/i);
  assert.match(LIVE_SIGNALS_FRAMING, /Automated observations/i);
  assert.equal(findClaimViolations(LIVE_SIGNALS_FRAMING).length, 0);
});

test("REGRESSION P1-10: the framing precedes the feed content, not follows it", () => {
  const src = readFileSync(path.join(root, LIVE_PANEL), "utf8");
  const headerAt = src.indexOf("function LiveSignalsHeader");
  const framingAt = src.indexOf("LIVE_SIGNALS_FRAMING", headerAt);
  const panelAt = src.indexOf("export function LiveFeedPanel");
  assert.ok(headerAt > 0 && framingAt > headerAt, "the framing belongs in the header");
  assert.ok(
    framingAt < panelAt,
    "a reader must meet the framing before any signal is rendered",
  );
});

/* ================================================================== *
 * 5. The vocabulary module stays pure and shared
 * ================================================================== */

test("the claim vocabulary is pure and importable from anywhere", () => {
  const src = codeOnly(readFileSync(path.join(root, "lib/trust/claims.ts"), "utf8"));
  for (const forbidden of [/server-only/, /\bfetch\(/, /node:fs/, /process\.env/, /from "react"/]) {
    assert.equal(forbidden.test(src), false, `claims.ts must not contain ${forbidden}`);
  }
  assert.equal(/import .* from/.test(src), false, "claims.ts must have no imports at all");
});

test("surfaces consume the shared strings rather than restating them", () => {
  // A copied-and-pasted disclosure drifts. These must reference the module.
  assert.match(
    readFileSync(path.join(root, LIVE_PANEL), "utf8"),
    /LIVE_SIGNALS_FRAMING/,
  );
  /*
   * Re-pinned: the crypto page is retired, and the comparison-basis disclosure
   * now lives on the one canonical commercial surface — the operators hub,
   * which derives its basis from the shared trust module rather than pasting it.
   */
  const hub = readFileSync(path.join(root, "app/[locale]/operators/page.tsx"), "utf8");
  assert.match(hub, /deriveOrderingBasis/);
  assert.match(hub, /OrderingDisclosure/);
});

/* ================================================================== *
 * 6. Sprint 20B-B surfaces still comply
 * ================================================================== */

test("the Acca surfaces built in Sprint 20B-B still pass the site-wide rules", () => {
  for (const rel of [
    "components/acca-publication/PublicAccaDetailView.tsx",
    "components/acca-publication/PublicAccaIndexView.tsx",
    "components/acca-publication/PublicAccaCard.tsx",
    "components/homepage/HomepagePublishedAccas.tsx",
  ]) {
    const violations = findClaimViolations(
      userFacingStrings(readFileSync(path.join(root, rel), "utf8")),
    );
    assert.deepEqual(violations, [], `${rel}: ${JSON.stringify(violations)}`);
  }
});
