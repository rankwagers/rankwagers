import type { Metadata } from "next";
import { EvidenceDiagnosticsDashboard } from "@/components/developer/EvidenceDiagnosticsDashboard";
import { getEvidenceDiagnostics } from "@/lib/evidence-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Evidence",
  robots: { index: false, follow: false },
};

export default function DeveloperEvidencePage() {
  const diagnostics = getEvidenceDiagnostics();
  return <EvidenceDiagnosticsDashboard diagnostics={diagnostics} />;
}
