import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/*
 * RETIRED (commercial conversion pass, 2026-08-10). Five overlapping commercial
 * families collapsed into ONE canonical surface: /operators (hub) and
 * /operators/[slug] (detail). A payment-method slice of the same list is a doorway, not a surface.
 * Permanent redirect; the route is out of the sitemap. Do not rebuild here.
 */
export default function RetiredCommercialDoor({
  params,
}: {
  params: { locale: Locale };
}) {
  permanentRedirect(`/${params.locale}/operators`);
}
