import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { ExperimentSectionView } from "@/components/admin-experiments/ExperimentSectionView";

export const dynamic = "force-dynamic";

export default function AdminExperimentsGuardrailsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <ExperimentSectionView
        section="guardrails"
        path="/admin/experiments/guardrails"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
