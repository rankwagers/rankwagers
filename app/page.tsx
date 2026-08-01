import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

/** Middleware yönlendirmesine ek yedek: kök URL her zaman locale ana sayfaya gider. */
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
