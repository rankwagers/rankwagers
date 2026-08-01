import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CalibrationSectionView } from "@/components/admin-calibration/CalibrationSectionView";

export const dynamic = "force-dynamic";

export default function AdminCalibrationOverviewPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <CalibrationSectionView
        section="overview"
        path="/admin/calibration/overview"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
