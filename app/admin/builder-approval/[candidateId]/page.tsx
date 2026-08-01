import { notFound } from "next/navigation";
import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CandidateDetailView } from "@/components/builder-approval/CandidateDetailView";
import { getFeatureFlags } from "@/lib/config/featureFlags";

/**
 * Builder Approval candidate detail route (Sprint 20B-A Phase E).
 *
 * Read-only. Same ordering as the list route: feature flag first (so a disabled feature is a
 * 404 and performs no candidate read), then admin authorization, then the view.
 */

export const dynamic = "force-dynamic";

export default function AdminBuilderApprovalCandidatePage({
  params,
}: {
  params: { candidateId: string };
}) {
  if (!getFeatureFlags().operatorApprovalEnabled) notFound();

  return (
    <AdminGate>
      <CandidateDetailView candidateId={params.candidateId} />
    </AdminGate>
  );
}
