import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AdminSectionView } from "@/components/admin-dashboard/AdminSectionView";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AdminSectionView
        section="overview"
        path="/admin/dashboard"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
