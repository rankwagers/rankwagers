/**
 * Canonical builder for affiliate /go/{slug} outbound paths.
 * Always attaches a signed r2 ctx token. Destination stays server-side.
 * Must never be imported from Client Components.
 */

import "server-only";

import { signRedirectContext } from "@/lib/operators/redirect-token";

export type GoPathInput = {
  slug: string;
  placement: string;
  subid?: string;
  locale?: string;
  country?: string;
  comboId?: string;
  operatorRank?: number;
  availability?: "full" | "partial" | "unknown" | "none";
  deeplinkType?: string;
  selectionCount?: number;
  targetOddsMin?: number;
  targetOddsMax?: number;
  actualComboOdds?: number;
  operatorComboOdds?: number;
  evidenceStrength?: string;
  marketTypes?: string[];
  offerId?: string;
  sessionId?: string;
  /** Extra non-destination query params (fixture_id, market, etc.). */
  extraQuery?: Record<string, string | undefined | null>;
};

export { goPathHasSignedContext } from "@/lib/operators/go-path-shared";

/** Build `/go/{slug}?ctx=…&subid=…` with a short-lived signed context. */
export function buildGoPath(input: GoPathInput): string {
  const slug = input.slug.trim().toLowerCase();
  if (!slug || slug.includes("/") || slug.includes("..")) {
    throw new Error("invalid_operator_slug");
  }

  const token = signRedirectContext({
    operatorId: slug,
    comboId: input.comboId,
    country: input.country,
    locale: input.locale,
    placement: input.placement,
    operatorRank: input.operatorRank,
    availability: input.availability,
    deeplinkType: input.deeplinkType,
    selectionCount: input.selectionCount,
    targetOddsMin: input.targetOddsMin,
    targetOddsMax: input.targetOddsMax,
    actualComboOdds: input.actualComboOdds,
    operatorComboOdds: input.operatorComboOdds,
    evidenceStrength: input.evidenceStrength,
    marketTypes: input.marketTypes,
    offerId: input.offerId,
    sessionId: input.sessionId,
  });

  const params = new URLSearchParams();
  params.set("ctx", token);
  if (input.subid) params.set("subid", input.subid);
  if (input.extraQuery) {
    for (const [key, value] of Object.entries(input.extraQuery)) {
      if (value == null || value === "") continue;
      const lower = key.toLowerCase();
      if (
        lower === "destination" ||
        lower === "url" ||
        lower === "redirect" ||
        lower === "host" ||
        lower === "ctx"
      ) {
        continue;
      }
      params.set(key, value);
    }
  }
  return `/go/${slug}?${params.toString()}`;
}
