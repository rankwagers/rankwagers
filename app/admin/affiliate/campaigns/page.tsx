import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AffiliateSectionView } from "@/components/admin-affiliate/AffiliateSectionView";

export const dynamic = "force-dynamic";

export default function AdminAffiliateCampaignsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AffiliateSectionView
        section="campaigns"
        path="/admin/affiliate/campaigns"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
