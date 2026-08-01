import type { Metadata } from "next";
import { SearchDiagnosticsDashboard } from "@/components/developer/SearchDiagnosticsDashboard";
import { getSearchDiagnostics, rebuildSearchIndex } from "@/lib/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Search",
  robots: { index: false, follow: false },
};

export default function DeveloperSearchPage() {
  rebuildSearchIndex();
  const diagnostics = getSearchDiagnostics();
  return <SearchDiagnosticsDashboard diagnostics={diagnostics} />;
}
