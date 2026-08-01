/**
 * Claim integrity (Sprint 27).
 *
 * The Product Manifesto's language rules, encoded ONCE so every surface is held to the same
 * standard instead of each one restating it:
 *
 *   "No fake confidence. No 'Guaranteed Win'. No 'AI says'. No editorial hype. Only evidence."
 *   "Everything shown on the platform must be explainable through data."
 *
 * Before this module those rules were enforced only on the Sprint 20B-B Acca surfaces — a
 * handful of files. Everything older was governed by prose in a backlog. This makes the rule
 * mechanical and site-wide, so a violation fails a test rather than waiting for an audit.
 *
 * PURE DATA AND PURE FUNCTIONS. No I/O, no React, no server-only imports. It is imported by
 * tests and may be imported by any surface that needs the shared disclosure strings.
 */

/* ------------------------------------------------------------------ *
 * Banned claims
 * ------------------------------------------------------------------ */

export type BannedClaim = {
  /** Matched case-insensitively against user-facing copy. */
  pattern: RegExp;
  /** Why it is banned, quoted back in the failure so the fix is obvious. */
  reason: string;
};

/**
 * Language that asserts an outcome, a certainty, or a profit.
 *
 * Deliberately NOT a blunt keyword list. Each pattern targets the *claim*, not the word:
 * "guarantee" is banned as a promise ("guaranteed returns") but must remain usable in an honest
 * denial ("not a guarantee"), which is exactly the phrasing the product already relies on. The
 * `NEGATED_CONTEXT` allowance below is what makes that distinction work.
 */
export const BANNED_CLAIMS: readonly BannedClaim[] = [
  { pattern: /\bguaranteed?\s+(win|winner|profit|return|payout|income)/i, reason: "promises an outcome" },
  { pattern: /\bwin\s+guaranteed\b/i, reason: "promises an outcome" },
  { pattern: /\bsure\s+(thing|bet|win)\b/i, reason: "asserts certainty" },
  { pattern: /\bcan'?t\s+lose\b/i, reason: "asserts certainty" },
  { pattern: /\bnever\s+lose\b/i, reason: "asserts certainty" },
  { pattern: /\b100%\s*(accurate|accuracy|certain|sure|win)/i, reason: "asserts impossible precision" },
  { pattern: /\brisk[-\s]?free\s+(bet|betting|profit|return)/i, reason: "denies risk that exists" },
  { pattern: /\bfixed\s+match/i, reason: "implies match fixing" },
  { pattern: /\binsider\s+(tip|info|information)/i, reason: "implies privileged information" },
  { pattern: /\bAI\s+(says|predicts|guarantees|knows)/i, reason: "attributes authority to a model" },
  { pattern: /\bour\s+(tip|tips|prediction)\s+(for|of)\s+today\b/i, reason: "positions the product as a tipster" },
  { pattern: /\bbanker\b/i, reason: "tipster slang asserting near-certainty" },
  { pattern: /\bbetting\s+tips\b/i, reason: "positions the product as a tipster" },
  /*
   * Sprint 35 — "tip" as a thing the product SUPPLIES.
   *
   * `betting tips` alone was too narrow and missed live copy: the Live Signals feature offered
   * "One free tip each hour" while the panel above it said "Not tips, not predictions, and not
   * advice". The product contradicted itself on one feature, and the guard caught neither side.
   *
   * The word is not banned outright — the honest denial "not tips" is exactly the phrasing the
   * manifesto wants, and `NEGATED_CONTEXT` protects it. What is banned is offering one.
   */
  { pattern: /\b(free|daily|exclusive|live|featured|hourly)\s+tips?\b/i, reason: "offers a tip as a product" },
  { pattern: /\btips?\s+(each|every|per)\s+(hour|day|week|match)\b/i, reason: "offers a tip as a product" },
  { pattern: /\bunlock\s+(more\s+)?tips?\b/i, reason: "offers a tip as a product" },
  { pattern: /\beasy\s+money\b/i, reason: "implies effortless profit" },
  { pattern: /\bdouble\s+your\s+money\b/i, reason: "promises a return" },
];

/**
 * Contexts in which a banned WORD is legitimate because the sentence denies the claim.
 *
 * "Model probability for this market — statistical indicator, not a guarantee." is exactly the
 * honesty the manifesto asks for, and must not be flagged as its opposite.
 */
export const NEGATED_CONTEXT: readonly RegExp[] = [
  /\bnot\s+a\s+guarantee\b/i,
  /\bare\s+not\s+guarantees?\b/i,
  /\bnot\s+guaranteed\b/i,
  /\bwithout\s+guarantee\b/i,
  /\bnever\s+guaranteed\b/i,
  /\bno\s+guarantees?\b/i,
  /\bcannot\s+guarantee\b/i,
  /\bdoes\s+not\s+guarantee\b/i,
  /\bnothing\s+is\s+guaranteed\b/i,
  /\bnot\s+a\s+(tip|prediction|recommendation)\b/i,
  /\bno\s+risk[-\s]?free\b/i,
  /\bno\s+insider\b/i,
  /\bnot\s+betting\s+tips\b/i,
  /\bno\s+betting\s+tips\b/i,
  /\bnot\s+tips\b/i,
  /*
   * "No guaranteed wins — transparent history only" is the homepage meta description: an
   * explicit denial and exactly the honesty the manifesto asks for. The original list only
   * negated "no guaranteed RETURNS", so the site's own honest copy was flagged as its opposite.
   * A negation is a negation whatever noun follows it.
   */
  /\bno\s+guaranteed?\b/i,
];

export type ClaimViolation = {
  match: string;
  reason: string;
  index: number;
};

/**
 * Find banned claims in a block of user-facing copy.
 *
 * A match inside a negating sentence is not a violation. The check is per-match, using a window
 * around the hit rather than the whole document, so one honest denial elsewhere on the page
 * cannot launder a genuine overclaim.
 */
export function findClaimViolations(text: string): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  for (const { pattern, reason } of BANNED_CLAIMS) {
    const rx = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let hit: RegExpExecArray | null;
    while ((hit = rx.exec(text)) !== null) {
      const window = text.slice(Math.max(0, hit.index - 60), hit.index + hit[0].length + 60);
      if (NEGATED_CONTEXT.some((n) => n.test(window))) continue;
      violations.push({ match: hit[0], reason, index: hit.index });
      if (hit[0].length === 0) rx.lastIndex++;
    }
  }
  return violations;
}

/* ------------------------------------------------------------------ *
 * Superlative ranking claims
 * ------------------------------------------------------------------ */

/**
 * A ranking assertion is not banned — the site legitimately compares operators — but it must be
 * ATTRIBUTABLE. "Our top-rated site is X" with no stated basis is marketing wearing the clothes
 * of a finding; "ranked by X, Y and Z, see methodology" is a claim a reader can check.
 *
 * These patterns detect an unqualified superlative so a test can require that the surrounding
 * copy names its basis.
 */
export const UNQUALIFIED_RANKING: readonly RegExp[] = [
  /\b(our\s+)?top[-\s]rated\b/i,
  /*
   * Sprint 35/36 — an intervening-word window, bounded by function words.
   *
   * The original required the noun IMMEDIATELY after "best", so the live homepage description
   * "Independent comparison of the best betting and crypto betting sites" passed the guard: the
   * word "betting" sat between "best" and "sites". A superlative does not stop being one because
   * an adjective intervenes.
   *
   * The window is five words, but it may not cross a function word.
   *
   * A plain `{0,N}` window is the wrong instrument. Three words was too few — the live homepage
   * description reads "the best BETTING AND CRYPTO BETTING sites", which is four — while simply
   * raising the count starts matching "the best WAY TO COMPARE betting sites", where "best"
   * modifies the method and makes no claim about the sites at all.
   *
   * Excluding the function words that introduce that other construction keeps the window on
   * adjectival modifiers, which is the only case a superlative is actually being asserted over
   * the noun.
   */
  /\bthe\s+best\s+(?:(?!\b(?:to|for|way|ways|place|time|times|how|if|when|of)\b)[\w&]+\s+){0,5}(sites?|bookmakers?|operators?|casinos?)\b/i,
  /\bnumber\s+one\s+(?:(?!\b(?:to|for|way|ways|place|time|times|how|if|when|of)\b)[\w&]+\s+){0,5}(sites?|bookmakers?|operators?)\b/i,
  /*
   * No leading \b. Sprint 30 found this pattern never matched: `\b` requires a word boundary,
   * and the position between a space and `#` is between two non-word characters, so it is not
   * one. `#1 site` therefore slipped through the detector entirely.
   */
  /#\s?1\s+(site|bookmaker|operator)\b/i,
];

/** Evidence of an attributable basis near a ranking claim. */
export const RANKING_BASIS: readonly RegExp[] = [
  /\bmethodolog/i,
  /\bcriteria\b/i,
  /\bhow\s+we\s+(rank|compare|assess)\b/i,
  /\bbased\s+on\s+.*\bmethodolog/i,
  /*
   * Sprint 35 removed `/\bindependent\s+comparison\b/i`.
   *
   * It was the widest escape hatch in this list and the only one that was not evidence of a
   * basis. "Independent comparison" asserts a POSTURE, not a GROUND: it tells the reader we are
   * unaffiliated, never on what criteria a ranking was produced. Every other entry here points at
   * something a reader can go and check — a methodology, named criteria, a stated procedure.
   *
   * It was also load-bearing in the wrong direction. The homepage meta description reads
   * "Independent comparison of the best betting and crypto betting sites"; the phrase qualified
   * the superlative sitting three words away from it, so widening UNQUALIFIED_RANKING in this
   * same sprint still left that string passing. A rule that lets a claim excuse itself by
   * calling itself independent cannot enforce the manifesto.
   *
   * Removing it makes the guard strictly stronger. Nothing that passed on real disclosed grounds
   * passes any less.
   */
];

export function hasUnqualifiedRanking(text: string): boolean {
  const ranked = UNQUALIFIED_RANKING.some((p) => p.test(text));
  if (!ranked) return false;
  return !RANKING_BASIS.some((p) => p.test(text));
}

/* ------------------------------------------------------------------ *
 * Extracting user-facing text from source
 * ------------------------------------------------------------------ */

/** Strip comments. Engineering prose is not shown to a reader and must not be scanned. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * Everything a reader can actually see in a source file.
 *
 * SPRINT 30 CORRECTION — this previously extracted string literals ONLY.
 *
 * That was a real blind spot, and it was mine: JSX text content is not a string literal, so
 * `<p>observed market history only</p>` and every other piece of JSX prose in the product was
 * invisible to the site-wide guard introduced in Sprint 27. The guard's coverage was therefore
 * narrower than that sprint's report claimed. Both forms are now extracted.
 *
 * Machine strings are still excluded — import specifiers, Tailwind class lists, template
 * expressions — because a noisy detector gets loosened until it stops detecting anything.
 */
export function extractUserFacingText(src: string): string {
  const code = stripComments(src);
  const parts: string[] = [];

  // 1. String literals.
  const literal = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = literal.exec(code)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? "";
    if (/^[@./]/.test(value)) continue;
    if (/(?:^|\s)(?:flex|text-|bg-|border|rounded|px-|py-|mt-|mb-|grid|gap-|absolute|relative)/.test(value)) continue;
    parts.push(value);
  }

  /*
   * 2. JSX text nodes.
   *
   * Delimited by `>` or `}` on the left and `<` or `{` on the right, because prose frequently
   * sits between two expressions — `{marketLabel} · observed market history only` is a real
   * example that a `>`-only rule missed entirely.
   *
   * The closing delimiter is a lookahead so adjacent text nodes are not swallowed by the
   * previous match.
   *
   * TypeScript generics produce the same bracket shape (`useState<Range>("24h"); const …`), so
   * anything containing code punctuation is discarded. Two consecutive letters are required, to
   * drop separators and arrows.
   */
  const jsxText = /[>}]([^<>{}]+)(?=[<{])/g;
  while ((m = jsxText.exec(code)) !== null) {
    const value = m[1].replace(/\s+/g, " ").trim();
    if (!value || !/[A-Za-z]{2}/.test(value)) continue;
    if (/[;=()[\]]/.test(value)) continue;
    parts.push(value);
  }

  return parts.join("\n");
}

/* ------------------------------------------------------------------ *
 * Shared disclosure strings
 * ------------------------------------------------------------------ */

/**
 * Framing for the Live Signals surface.
 *
 * The backlog recorded this as "Live Signals tipster risk": a live-updating feed of "signals"
 * with a pulsing indicator and no framing reads as a tip service, which is precisely what this
 * product is not. Stating what a signal IS — an automated market-movement observation — and what
 * it is not is the minimum that makes the surface honest.
 */
export const LIVE_SIGNALS_FRAMING =
  "Automated observations of market and match activity. Not tips, not predictions, and not advice — decide for yourself.";

/** Standing disclosure for any surface that compares commercial operators. */
export const OPERATOR_COMPARISON_BASIS =
  "Independent comparison. Ordering reflects our published criteria, not commercial arrangements.";

/** Standing risk disclosure for any surface presenting odds. */
export const ODDS_ARE_POINT_IN_TIME =
  "Odds were recorded when this page was generated and may have changed or become unavailable.";
