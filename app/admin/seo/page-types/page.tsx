import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { SeoSectionView } from "@/components/admin-seo/SeoSectionView";

export const dynamic = "force-dynamic";

export default function AdminSeoPageTypesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <SeoSectionView
        section="page-types"
        path="/admin/seo/page-types"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
