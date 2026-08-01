import { ACCA_LIMITS } from "./contracts";

/**
 * Public Acca slug generation (Sprint 20B-B, stage B1).
 *
 * Pure and deterministic: the same inputs always produce the same slug. Database uniqueness
 * and collision RESOLUTION belong to stage B2 — this module only defines the contract by
 * which persistence may append a stable suffix.
 *
 * Turkish is folded explicitly BEFORE lowercasing, because JavaScript's default casing is
 * wrong for it: "İ".toLowerCase() yields "i" plus a combining dot rather than "i", and a
 * dotless "ı" would otherwise be stripped as a non-ASCII character.
 */

/** Turkish characters have no correct generic transliteration, so map them explicitly. */
const TURKISH_FOLD: Record<string, string> = {
  "ı": "i",
  "İ": "i",
  "ş": "s",
  "Ş": "s",
  "ğ": "g",
  "Ğ": "g",
  "ü": "u",
  "Ü": "u",
  "ö": "o",
  "Ö": "o",
  "ç": "c",
  "Ç": "c",
};

function foldTurkish(value: string): string {
  let out = "";
  for (const ch of value) out += TURKISH_FOLD[ch] ?? ch;
  return out;
}

/**
 * Drop Unicode combining diacritical marks (U+0300-U+036F).
 *
 * A code-point filter rather than a regex character range, so this source file never has to
 * contain raw combining characters — they are invisible in editors and fragile across
 * encodings.
 */
function stripCombiningMarks(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += ch;
  }
  return out;
}

/**
 * Normalize arbitrary text to a URL-safe lowercase slug segment.
 *
 * Anything that is not [a-z0-9] becomes a separator, runs collapse, and leading/trailing
 * separators are trimmed. Emoji and unsupported scripts therefore disappear rather than
 * being percent-encoded into an unreadable URL — an intentional, predictable loss.
 */
export function slugifyText(
  raw: unknown,
  maxLength: number = ACCA_LIMITS.maxSlugLength,
): string {
  if (typeof raw !== "string") return "";
  // NFKD splits accented characters into base + combining mark; then drop the marks.
  const decomposed = stripCombiningMarks(foldTurkish(raw).normalize("NFKD"));
  const ascii = decomposed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii.length <= maxLength) return ascii;
  // Truncate, then re-trim so the slug never ends on a stray separator.
  return ascii.slice(0, maxLength).replace(/-+$/g, "");
}

export type AccaSlugResult =
  | { ok: true; slug: string; base: string }
  | { ok: false; code: "slug_empty" };

/**
 * Build a public Acca slug.
 *
 * `discriminator` is the persistence-layer collision suffix contract: stage B2 supplies a
 * short, stable token (for example a fragment of the Acca id) when the base collides. It is
 * normalized like any other segment, so it can never introduce unsafe characters, and it is
 * appended so the readable part stays first.
 *
 * A title that normalizes to nothing (empty, punctuation-only, emoji-only) is a typed
 * failure, not a silent fallback: persistence must decide, and a generic invented slug would
 * collide constantly while telling a reader nothing.
 */
export function buildAccaSlug(input: {
  title: unknown;
  discriminator?: string | null;
  maxLength?: number;
}): AccaSlugResult {
  const maxLength = input.maxLength ?? ACCA_LIMITS.maxSlugLength;
  const suffix = input.discriminator ? slugifyText(input.discriminator, maxLength) : "";

  // Reserve room for the suffix so truncation eats the readable base, never the uniqueness
  // token — otherwise a long title could silently drop the very thing making it unique.
  const reserved = suffix ? suffix.length + 1 : 0;
  const baseBudget = Math.max(1, maxLength - reserved);
  const base = slugifyText(input.title, baseBudget);

  if (!base && !suffix) return { ok: false, code: "slug_empty" };
  const slug = base && suffix ? `${base}-${suffix}` : base || suffix;
  return { ok: true, slug, base };
}

/** Shape check for a slug arriving from a URL, before it reaches persistence. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidAccaSlug(
  value: unknown,
  maxLength: number = ACCA_LIMITS.maxSlugLength,
): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    SLUG_RE.test(value)
  );
}
