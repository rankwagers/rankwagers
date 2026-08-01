import type { Metadata } from "next";
import { OperatorIntegrationDashboard } from "@/components/developer/OperatorIntegrationDashboard";
import {
  buildAffiliateDiagnostics,
  buildOperatorsDiagnostics,
} from "@/lib/operators/diagnostics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Operators",
  robots: { index: false, follow: false },
};

export default async function DeveloperOperatorsPage() {
  return (
    <OperatorIntegrationDashboard
      operators={buildOperatorsDiagnostics()}
      affiliate={await buildAffiliateDiagnostics()}
    />
  );
}
