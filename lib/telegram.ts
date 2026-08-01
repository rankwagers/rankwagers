export const DEFAULT_TELEGRAM_BOT_URL = "https://t.me/rankwagersbot";

/** Bot deep link for live/upcoming CTAs (env override, then default). */
export function resolveTelegramBotUrl(fromApi?: string | null): string {
  const api = fromApi?.trim();
  if (api) return api;
  const env =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL?.trim() ||
    process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim();
  return env || DEFAULT_TELEGRAM_BOT_URL;
}
