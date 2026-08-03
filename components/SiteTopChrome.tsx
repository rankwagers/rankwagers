import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { Header } from "@/components/Header";

export function SiteTopChrome({
  dict,
  locale,
}: {
  dict: FullDictionary;
  locale: Locale;
}) {
  return (
    /*
     * The prototype's chrome, applied site-wide (34 routes) rather than to the homepage alone —
     * a homepage-only header would open a second seam instead of closing the first.
     *
     * `.rw-hero` is what makes the conversion work: the scope carries the palette, the type and
     * the motion tokens, and the fonts are already wired on <html> by the root layout, so every
     * route resolves them. STRUCTURE IS UNCHANGED — the nav budget, the min-w-0 clipping
     * mechanics, search, language switcher and mobile nav are all untouched. Colour and type only.
     */
    <div className="rw-hero sticky top-0 z-40 w-full border-b border-[var(--hero-line)]/80 bg-[var(--hero-canvas)]/80 backdrop-blur-xl">
      <Header dict={dict} locale={locale} embedded />
    </div>
  );
}
