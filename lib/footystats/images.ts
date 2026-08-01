import { FOOTYSTATS_IMAGE_CDN } from "./config";

export function teamImageUrl(path?: string | null): string | undefined {
  if (!path || typeof path !== "string") return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const clean = trimmed.replace(/^\//, "");
  if (clean.startsWith("img/")) {
    return `${FOOTYSTATS_IMAGE_CDN}/${clean}`;
  }
  return `${FOOTYSTATS_IMAGE_CDN}/img/${clean}`;
}

export function leagueImageUrl(image?: string | null): string | undefined {
  if (!image || typeof image !== "string") return undefined;
  const trimmed = image.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return teamImageUrl(trimmed);
}
