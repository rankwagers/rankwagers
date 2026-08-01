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
    <div className="sticky top-0 z-40 w-full border-b border-border bg-[var(--canvas-secondary)]/95 backdrop-blur-md">
      <Header dict={dict} locale={locale} embedded />
    </div>
  );
}
