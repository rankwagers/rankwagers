import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AffiliateSectionView } from "@/components/admin-affiliate/AffiliateSectionView";

export const dynamic = "force-dynamic";

export default function AdminAffiliateRedirectsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AffiliateSectionView
        section="redirects"
        path="/admin/affiliate/redirects"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
