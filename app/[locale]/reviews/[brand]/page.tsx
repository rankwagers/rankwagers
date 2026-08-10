import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/*
 * RETIRED (commercial conversion pass, 2026-08-10). Five overlapping commercial
 * families collapsed into ONE canonical surface: /operators (hub) and
 * /operators/[slug] (detail). A review IS the operator detail page — same slug space, one identity.
 * Permanent redirect; the route is out of the sitemap. Do not rebuild here.
 */
export default function RetiredReviewPage({
  params,
}: {
  params: { locale: Locale; brand: string };
}) {
  permanentRedirect(`/${params.locale}/operators/${params.brand}`);
}
