import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { SeoSectionView } from "@/components/admin-seo/SeoSectionView";

export const dynamic = "force-dynamic";

export default function AdminSeoInternalLinksPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <SeoSectionView
        section="internal-links"
        path="/admin/seo/internal-links"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
