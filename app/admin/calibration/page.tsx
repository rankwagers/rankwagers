import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminCalibrationIndexPage() {
  redirect("/admin/calibration/overview");
}
