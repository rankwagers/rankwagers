/** FootyStats / API status → postponed or cancelled (not settled as W/L). */
export function isMatchPostponed(status: string | undefined | null): boolean {
  const s = (status ?? "").toLowerCase().trim();
  if (!s) return false;
  return (
    s.includes("postpon") ||
    s.includes("cancel") ||
    s.includes("abandon") ||
    s.includes("suspend") ||
    s === "pst" ||
    s === "post" ||
    s === "canc" ||
    s === "abd"
  );
}
