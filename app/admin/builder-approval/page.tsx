import { notFound } from "next/navigation";
import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { CandidateListView } from "@/components/builder-approval/CandidateListView";
import { getFeatureFlags } from "@/lib/config/featureFlags";

/**
 * Builder Approval candidate list route (Sprint 20B-A Phase E).
 *
 * The feature flag is checked BEFORE `AdminGate` and before any candidate read, so:
 *  - a disabled feature is indistinguishable from a route that does not exist;
 *  - no candidate service call happens while disabled;
 *  - nothing misleading is rendered in the disabled state.
 *
 * `notFound()` is the repository's established disabled-feature behaviour for admin surfaces
 * (see `AdminGate`, which calls `notFound()` on `route_disabled`). Indexing protection comes
 * from `app/admin/layout.tsx`, which already applies noindex/nofollow/noarchive.
 */

export const dynamic = "force-dynamic";

export default function AdminBuilderApprovalPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!getFeatureFlags().operatorApprovalEnabled) notFound();

  return (
    <AdminGate>
      <CandidateListView searchParams={searchParams} />
    </AdminGate>
  );
}
