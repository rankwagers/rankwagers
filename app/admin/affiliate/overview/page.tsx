import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AffiliateSectionView } from "@/components/admin-affiliate/AffiliateSectionView";

export const dynamic = "force-dynamic";

export default function AdminAffiliateOverviewPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AffiliateSectionView
        section="overview"
        path="/admin/affiliate/overview"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
