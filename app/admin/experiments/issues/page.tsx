import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { ExperimentSectionView } from "@/components/admin-experiments/ExperimentSectionView";

export const dynamic = "force-dynamic";

export default function AdminExperimentsİssuesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <ExperimentSectionView
        section="issues"
        path="/admin/experiments/issues"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
