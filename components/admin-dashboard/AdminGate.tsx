import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ADMIN_COOKIE,
  clientKey,
  evaluateAdminAccess,
} from "@/lib/security/adminAuth";
import { AdminLoginForm } from "./AdminLoginForm";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const access = evaluateAdminAccess({
    headers: headers(),
    cookieValue: cookies().get(ADMIN_COOKIE)?.value,
    clientKey: clientKey({ headers: headers() }),
  });

  if (!access.ok && access.code === "route_disabled") {
    notFound();
  }
  if (!access.ok) {
    return <AdminLoginForm />;
  }
  return <>{children}</>;
}
