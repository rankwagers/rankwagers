/**
 * Browser-safe helpers for /go path inspection and unsigned path shape.
 * No secrets, no node:crypto.
 */

export type GoPathQueryInput = {
  slug: string;
  subid?: string;
  extraQuery?: Record<string, string | undefined | null>;
};

/** True when path is a signed /go outbound (has ctx=). */
export function goPathHasSignedContext(path: string): boolean {
  if (!path.startsWith("/go/")) return false;
  try {
    const url = new URL(path, "http://local.invalid");
    const ctx = url.searchParams.get("ctx") ?? "";
    return ctx.startsWith("r2.") || ctx.startsWith("r1.");
  } catch {
    return false;
  }
}

/**
 * Build `/go/{slug}?…` without a signed ctx.
 * Only for intermediate server enrichment or tests — UI CTAs must use buildGoPath.
 */
export function buildGoPathUnsigned(input: GoPathQueryInput): string {
  const slug = input.slug.trim().toLowerCase();
  if (!slug || slug.includes("/") || slug.includes("..")) {
    throw new Error("invalid_operator_slug");
  }
  const params = new URLSearchParams();
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
  const qs = params.toString();
  return qs ? `/go/${slug}?${qs}` : `/go/${slug}`;
}
