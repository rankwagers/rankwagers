import { AffPanelDashboard } from "@/components/AffPanelDashboard";
import { PersistKey } from "@/components/PersistKey";
import { adminKey } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export default function AffPanelPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const keyParam = searchParams.key ?? "";
  const expected = adminKey();
  const persist = keyParam && keyParam === expected ? keyParam : "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {persist ? <PersistKey value={persist} /> : null}
      <AffPanelDashboard adminKeyFromUrl={persist} />
    </main>
  );
}
