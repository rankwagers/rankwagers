// Ülke kodundan bayrak emojisi (regional indicator harfleri).
export function flagEmoji(cc: string): string {
  const code = (cc || "").toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (code.charCodeAt(0) - 65),
    A + (code.charCodeAt(1) - 65)
  );
}

let regionDisplay: Intl.DisplayNames | null = null;
try {
  regionDisplay = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  regionDisplay = null;
}

// Ülke kodundan tam ad (Intl.DisplayNames ile, yoksa kodun kendisi).
export function countryName(cc: string): string {
  const code = (cc || "").toUpperCase();
  if (!code || code === "??") return "Unknown";
  try {
    return regionDisplay?.of(code) || code;
  } catch {
    return code;
  }
}
