import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { ExperimentSectionView } from "@/components/admin-experiments/ExperimentSectionView";

export const dynamic = "force-dynamic";

export default function AdminExperimentsDefinitionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <ExperimentSectionView
        section="definitions"
        path="/admin/experiments/definitions"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
