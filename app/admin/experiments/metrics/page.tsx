import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { ExperimentSectionView } from "@/components/admin-experiments/ExperimentSectionView";

export const dynamic = "force-dynamic";

export default function AdminExperimentsMetricsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <ExperimentSectionView
        section="metrics"
        path="/admin/experiments/metrics"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
