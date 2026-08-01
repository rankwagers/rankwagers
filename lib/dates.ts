export type DateInput = string | number | Date;

function invalidDate(input: DateInput): never {
  throw new Error(`Invalid date input: ${String(input)}`);
}

/** Normalizes ISO, JavaScript Date, Unix seconds, and Unix milliseconds. */
export function normalizeDate(input: DateInput): Date {
  const date =
    input instanceof Date
      ? new Date(input.getTime())
      : typeof input === "number"
        ? new Date(Math.abs(input) < 100_000_000_000 ? input * 1000 : input)
        : new Date(input);
  if (Number.isNaN(date.getTime())) return invalidDate(input);
  return date;
}

export function formatKickoff(
  input: DateInput,
  {
    locale = "en-GB",
    timeZone,
    includeYear = false,
  }: { locale?: string; timeZone?: string; includeYear?: boolean } = {}
): string {
  const date = normalizeDate(input);
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
  return formatted.replace(",", " ·");
}

export function formatRelativeUpdate(
  input: DateInput,
  { now = new Date() }: { now?: DateInput; locale?: string; timeZone?: string } = {}
): string {
  const timestamp = normalizeDate(input).getTime();
  const nowTimestamp = normalizeDate(now).getTime();
  const minutes = Math.max(0, Math.round((nowTimestamp - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  if (minutes < 24 * 60) return `Updated ${Math.round(minutes / 60)}h ago`;
  return `Updated ${Math.round(minutes / (24 * 60))}d ago`;
}
