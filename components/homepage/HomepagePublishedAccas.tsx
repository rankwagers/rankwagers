import Link from "next/link";
import { PublicAccaCard } from "@/components/acca-publication/PublicAccaCard";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { listPublicAccaViews, publicAccaIndexPath } from "@/lib/acca-publication/public";

/**
 * Homepage published-Acca section (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * SELF-CONTAINED AND SELF-HIDING. It fetches its own data and returns `null` when nothing is
 * published — or when the public Acca surface is switched off, because the read layer returns
 * nothing in that case too. That keeps the integration additive: the large `RankWagersHome`
 * component is untouched, and the common launch state (nothing published) renders exactly as the
 * homepage does today.
 *
 * Bounded to three. The homepage is a research entry point, not a feed; a long list here would
 * push the qualified-fixture explorer below the fold to promote combinations, which inverts the
 * intended journey.
 */

const HOMEPAGE_ACCA_LIMIT = 3;

export async function HomepagePublishedAccas({ locale }: { locale: string }) {
 const scan = await listPublicAccaViews({
 locale,
 now: new Date().toISOString(),
 scanLimit: HOMEPAGE_ACCA_LIMIT,
 });
 if (scan.views.length === 0) return null;

 return (
 <section className="container-wide mt-12" aria-labelledby="published-accas">
 <div className="flex flex-wrap items-baseline justify-between gap-2">
 <h2 id="published-accas" className="text-lg font-semibold">
 Recently published Accas
 </h2>
 <Link
 href={publicAccaIndexPath(locale)}
 className="text-sm text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 All published Accas
 </Link>
 </div>
 <p className="mt-1 max-w-2xl text-sm text-[var(--ink-secondary)]">
 Combinations published with the evidence behind them and the price recorded at the time.
 Not tips.
 </p>
 <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {scan.views.slice(0, HOMEPAGE_ACCA_LIMIT).map((view, index) => (
 <PublicAccaCard key={view.publicId} view={view} position={index + 1} p={getDictionary(locale as Locale).predictions} />
 ))}
 </div>
 </section>
 );
}
