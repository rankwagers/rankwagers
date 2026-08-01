import { notFound } from "next/navigation";
import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AccaDetailView } from "@/components/acca-publication/AccaDetailView";
import { getFeatureFlags } from "@/lib/config/featureFlags";

/**
 * Admin Acca detail route (Sprint 20B-B, stage B4).
 *
 * Same ordering as the list route: feature flag, then authorization, then the view.
 */

export const dynamic = "force-dynamic";

export default function AdminAccaDetailPage({ params }: { params: { accaId: string } }) {
  if (!getFeatureFlags().operatorApprovalEnabled) notFound();

  return (
    <AdminGate>
      <AccaDetailView accaId={params.accaId} />
    </AdminGate>
  );
}
