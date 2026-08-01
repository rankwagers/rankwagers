import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AffiliateSectionView } from "@/components/admin-affiliate/AffiliateSectionView";

export const dynamic = "force-dynamic";

export default function AdminAffiliateFunnelsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AffiliateSectionView
        section="funnels"
        path="/admin/affiliate/funnels"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
