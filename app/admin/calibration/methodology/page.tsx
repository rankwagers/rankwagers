import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CalibrationSectionView } from "@/components/admin-calibration/CalibrationSectionView";

export const dynamic = "force-dynamic";

export default function AdminCalibrationMethodologyPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <CalibrationSectionView
        section="methodology"
        path="/admin/calibration/methodology"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
