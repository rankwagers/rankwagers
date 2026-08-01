import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AdminSectionView } from "@/components/admin-dashboard/AdminSectionView";

export const dynamic = "force-dynamic";

export default function AdminBuilderPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <AdminSectionView
        section="builder"
        path="/admin/builder"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
