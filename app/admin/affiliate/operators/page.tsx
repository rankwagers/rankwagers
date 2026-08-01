import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AffiliateSectionView } from "@/components/admin-affiliate/AffiliateSectionView";

export const dynamic = "force-dynamic";

export default function AdminAffiliateOperatorsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AffiliateSectionView
        section="operators"
        path="/admin/affiliate/operators"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
