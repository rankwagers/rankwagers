import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { SeoSectionView } from "@/components/admin-seo/SeoSectionView";

export const dynamic = "force-dynamic";

export default function AdminSeoStructuredDataPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <SeoSectionView
        section="structured-data"
        path="/admin/seo/structured-data"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
