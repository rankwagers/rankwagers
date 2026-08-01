import type { Metadata } from "next";
import { CrawlQualityDashboard } from "@/components/developer/CrawlQualityDashboard";
import { getCrawlQualityReport } from "@/lib/crawl-quality";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Crawl quality",
  robots: { index: false, follow: false },
};

export default function DeveloperCrawlQualityPage({
  searchParams,
}: {
  searchParams?: { category?: string; severity?: string; q?: string };
}) {
  const report = getCrawlQualityReport({ force: true });
  return (
    <CrawlQualityDashboard
      report={report}
      filters={{
        category: searchParams?.category,
        severity: searchParams?.severity,
        q: searchParams?.q,
      }}
    />
  );
}
