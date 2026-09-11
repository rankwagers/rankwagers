import { AdminGate } from "@/components/admin-dashboard/AdminGate";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";
import { FeaturedPicksManager } from "@/components/admin-dashboard/FeaturedPicksManager";
import { IconSprite } from "@/components/v3/Icon";

/**
 * Admin featured picks route (Bible V3, block F). Gate first, per every
 * admin route; indexing protection comes from `app/admin/layout.tsx`.
 * The manager carries the rw3 scope itself — /admin sits outside the
 * locale shell, and the live band preview needs the real tokens under it.
 */

export const dynamic = "force-dynamic";

export default function AdminFeaturedPage() {
  return (
    <AdminGate>
      <AdminShell title="Featured picks" activePath="/admin/featured">
        <div className="rw3" style={{ borderRadius: 6 }}>
          <IconSprite />
          <FeaturedPicksManager />
        </div>
      </AdminShell>
    </AdminGate>
  );
}
