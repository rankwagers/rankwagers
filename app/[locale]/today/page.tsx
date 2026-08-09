import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/*
 * DECIDED (route-conversion batch, Family E): /today stays an honest redirect.
 * The homepage IS today's research page — one clock, one home for the current
 * day — so a separate "today" page would duplicate it and split the record.
 * Recorded in docs/route-inventory.md; do not re-open without new evidence.
 */
export default function TodayRedirectPage({ params }: { params: { locale: Locale } }) {
  redirect(`/${params.locale}`);
}
