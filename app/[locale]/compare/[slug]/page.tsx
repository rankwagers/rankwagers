import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/*
 * RETIRED (commercial conversion pass, 2026-08-10). Five overlapping commercial
 * families collapsed into ONE canonical surface: /operators (hub) and
 * /operators/[slug] (detail). Pairwise comparison derives nothing the hub's disclosed ordering does not already state.
 * Permanent redirect; the route is out of the sitemap. Do not rebuild here.
 */
export default function RetiredComparePage({
  params,
}: {
  params: { locale: Locale; slug: string };
}) {
  permanentRedirect(`/${params.locale}/operators`);
}
