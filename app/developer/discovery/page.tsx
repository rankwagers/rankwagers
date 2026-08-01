import type { Metadata } from "next";
import { DiscoveryDiagnosticsDashboard } from "@/components/developer/DiscoveryDiagnosticsDashboard";
import { getDiscoveryDiagnostics, recommendForEntity } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Discovery",
  robots: { index: false, follow: false },
};

export default function DeveloperDiscoveryPage() {
  // Warm cache with a sample recommendation for timing diagnostics.
  recommendForEntity(
    { entityType: "competition", slug: "premier-league" },
    { locale: "en", depth: 2, limitPerPanel: 6 }
  );
  const diagnostics = getDiscoveryDiagnostics();
  return <DiscoveryDiagnosticsDashboard diagnostics={diagnostics} />;
}
