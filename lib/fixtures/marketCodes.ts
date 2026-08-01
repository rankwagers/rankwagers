/** Map display filter codes ↔ settled market keys. */
export function filterCodeToMarketKey(code: string): string | null {
  switch (code) {
    case "O1.5":
      return "over15";
    case "O2.5":
      return "over25";
    case "1H 0.5":
      return "fh";
    case "2H 0.5":
      return "sh";
    case "over15":
    case "over25":
    case "fh":
    case "sh":
    case "btts":
      return code;
    default:
      return null;
  }
}
