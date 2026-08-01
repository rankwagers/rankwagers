import type { Metadata } from "next";
import { DataQualityDashboard } from "@/components/developer/DataQualityDashboard";
import { getDataQualityReport } from "@/lib/data-quality";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Data quality",
  robots: { index: false, follow: false },
};

export default function DeveloperDataQualityPage({
  searchParams,
}: {
  searchParams?: { category?: string; severity?: string; q?: string };
}) {
  const report = getDataQualityReport({ force: true });
  return (
    <DataQualityDashboard
      report={report}
      filters={{
        category: searchParams?.category,
        severity: searchParams?.severity,
        q: searchParams?.q,
      }}
    />
  );
}
