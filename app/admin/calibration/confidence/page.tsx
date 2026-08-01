import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CalibrationSectionView } from "@/components/admin-calibration/CalibrationSectionView";

export const dynamic = "force-dynamic";

export default function AdminCalibrationConfidencePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <CalibrationSectionView
        section="confidence"
        path="/admin/calibration/confidence"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
