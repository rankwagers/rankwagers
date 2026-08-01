import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Canonical entry → Overview dashboard */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
