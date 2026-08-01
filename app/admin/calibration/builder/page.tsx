import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CalibrationSectionView } from "@/components/admin-calibration/CalibrationSectionView";

export const dynamic = "force-dynamic";

export default function AdminCalibrationBuilderPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AdminGate>
      <CalibrationSectionView
        section="builder"
        path="/admin/calibration/builder"
        searchParams={searchParams}
      />
    </AdminGate>
  );
}
