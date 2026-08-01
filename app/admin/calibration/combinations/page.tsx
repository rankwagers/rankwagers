import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CalibrationSectionView } from "@/components/admin-calibration/CalibrationSectionView";

export const dynamic = "force-dynamic";

export default function AdminCalibrationCombinationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <CalibrationSectionView
        section="combinations"
        path="/admin/calibration/combinations"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
