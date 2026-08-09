import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { getDailyMatchListsSafe } from "@/lib/footystats/client";
import { resolveEdition } from "@/lib/homepage/edition";
import { formatDict } from "@/lib/dictionaryExtras";

/**
 * The masthead's own line: `Lists retrieved 08:31 UTC · Edition 216 · 18+`.
 *
 * Built here, on the server, because both halves are facts about the publication rather than about
 * the reader: the retrieval stamp comes from the provider response the homepage already fetched,
 * and the edition comes off the archive directory.
 *
 * EVERY SEGMENT IS OMITTED INDEPENDENTLY. A stamp that will not parse, or an empty archive, drops
 * its own segment and leaves the rest — so the line degrades to `18+` rather than to a row of
 * placeholders. `18+` is the one segment that is always true.
 *
 * The lists call is `unstable_cache`d at 300s and is the same call the homepage makes, so the
 * masthead costs one cache hit rather than a second provider round-trip.
 */
async function mastheadMeta(dict: FullDictionary): Promise<string> {
  const p = dict.predictions;
  const segments: string[] = [];

  const lists = await getDailyMatchListsSafe();
  if (!("error" in lists)) {
    const fetchedAt = new Date(lists.fetchedAt);
    if (!Number.isNaN(fetchedAt.getTime())) {
      segments.push(
        formatDict(p.heroStageUpdated, {
          time: new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC",
          }).format(fetchedAt),
        })
      );
    }
  }

  const edition = await resolveEdition();
  if (edition) segments.push(formatDict(p.mastheadEdition, { n: String(edition.number) }));

  segments.push("18+");
  return segments.join(" · ");
}

export async function SiteTopChrome({
  dict,
  locale,
}: {
  dict: FullDictionary;
  locale: Locale;
}) {
  const meta = await mastheadMeta(dict);

  return (
    /*
     * The prototype's chrome, applied site-wide (34 routes) rather than to the homepage alone —
     * a homepage-only header would open a second seam instead of closing the first.
     *
     * `.rw-hero` is what makes the conversion work: the scope carries the palette, the type and
     * the motion tokens, and the fonts are already wired on <html> by the root layout, so every
     * route resolves them.
     *
     * NOT STICKY. The masthead is a masthead now — it carries the edition line and closes on the
     * thick rule, and a masthead that follows the reader down the page is a toolbar wearing one.
     * The map prints it once, at the top, and lets it scroll away.
     */
    /*
     * `pb-px -mb-px`: the masthead's ground bleeds one pixel UNDER the next block. The masthead
     * and `main` are siblings with different backdrops — the layout wrapper behind both is the
     * site's cream — and on fractional-DPR phone screens the browser can round the two boxes'
     * edges to different device pixels, exposing a hair of that cream between them. The bleed
     * makes the two grounds overlap instead of abut, so rounding has nothing to expose. Net
     * height change is zero (the negative margin returns the pixel), so no layout moves.
     */
    <div className="rw-hero w-full bg-[var(--hero-canvas)] pb-px -mb-px">
      <Header dict={dict} locale={locale} meta={meta} embedded />
    </div>
  );
}
