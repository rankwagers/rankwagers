import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export default function TodayRedirectPage({ params }: { params: { locale: Locale } }) {
  redirect(`/${params.locale}`);
}
