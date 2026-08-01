import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { ExperimentSectionView } from "@/components/admin-experiments/ExperimentSectionView";

export const dynamic = "force-dynamic";

export default function AdminExperimentsAuditPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <ExperimentSectionView
        section="audit"
        path="/admin/experiments/audit"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
