import Link from "next/link";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

/** Design Bible §24.1 — methodology note + inline disclosure (home). */
export function BibleHomeNotes({ dict, locale }: { dict: FullDictionary; locale: Locale }) {
  const p = dict.predictions;
  return (
    <div className="mt-10 space-y-4 border-t border-[var(--border-default)] pt-8">
      <p className="max-w-2xl text-caption leading-relaxed text-muted-foreground">
        {p.bibleMethodologyNote}{" "}
        <Link
          href={`/${locale}/best-betting-sites`}
          className="font-medium text-brand hover:underline"
        >
          {p.bibleMethodologyLink}
        </Link>
      </p>
      <p className="max-w-2xl text-metadata leading-relaxed text-muted-foreground">
        {dict.footer.disclaimer}
      </p>
    </div>
  );
}
