import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { SeoSectionView } from "@/components/admin-seo/SeoSectionView";

export const dynamic = "force-dynamic";

export default function AdminSeoContentQualityPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <SeoSectionView
        section="content-quality"
        path="/admin/seo/content-quality"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
