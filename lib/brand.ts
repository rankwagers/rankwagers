/** Public brand name (nav, titles, schema). Align with SITE_URL / domain. */
export const SITE_NAME = "RankWagers";

export function siteBrand(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_NAME?.trim();
  return fromEnv || SITE_NAME;
}
