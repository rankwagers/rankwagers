/** Hypothesis quality helpers. */
export function isHypothesisAdequate(text: string): boolean {
  const t = text.trim();
  return t.length >= 20 && /\b(will|increases?|reduces?|improves?)\b/i.test(t);
}
