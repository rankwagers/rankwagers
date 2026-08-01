import type { Metadata } from "next";
import { CtrAnalyticsDashboard } from "@/components/developer/CtrAnalyticsDashboard";
import { getCtrDashboardData } from "@/lib/analytics/ctrDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · CTR analytics",
  robots: { index: false, follow: false },
};

export default async function DeveloperAnalyticsPage() {
  const data = await getCtrDashboardData();
  return <CtrAnalyticsDashboard data={data} />;
}
