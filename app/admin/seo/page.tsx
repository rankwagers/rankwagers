import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminSeoIndexPage() {
  redirect("/admin/seo/overview");
}
