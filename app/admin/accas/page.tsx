import { notFound } from "next/navigation";
import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AccaListView } from "@/components/acca-publication/AccaListView";
import { getFeatureFlags } from "@/lib/config/featureFlags";

/**
 * Admin Acca Studio list route (Sprint 20B-B, stage B4).
 *
 * Ordering matches the Phase E admin routes exactly: feature flag first — so a disabled feature
 * is indistinguishable from a route that does not exist and performs no Acca read — then admin
 * authorization, then the view. Indexing protection comes from `app/admin/layout.tsx`, which
 * already applies noindex/nofollow/noarchive.
 */

export const dynamic = "force-dynamic";

export default function AdminAccasPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!getFeatureFlags().operatorApprovalEnabled) notFound();

  return (
    <AdminGate>
      <AccaListView searchParams={searchParams} />
    </AdminGate>
  );
}
