import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { SeoSectionView } from "@/components/admin-seo/SeoSectionView";

export const dynamic = "force-dynamic";

export default function AdminSeoSitemapsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <SeoSectionView
        section="sitemaps"
        path="/admin/seo/sitemaps"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
