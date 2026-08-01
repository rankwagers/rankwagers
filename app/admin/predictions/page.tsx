import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AdminSectionView } from "@/components/admin-dashboard/AdminSectionView";

export const dynamic = "force-dynamic";

export default function AdminPredictionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AdminSectionView
        section="predictions"
        path="/admin/predictions"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
