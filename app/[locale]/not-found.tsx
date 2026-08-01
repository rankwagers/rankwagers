import { headers } from "next/headers";
import Link from "next/link";
import { defaultLocale, isLocale } from "@/lib/i18n";

export default function LocaleNotFound() {
  const headerLocale = headers().get("x-locale");
  const locale =
    headerLocale && isLocale(headerLocale) ? headerLocale : defaultLocale;
  const home = `/${locale}`;

  return (
    <div
      className="container-wide flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-metadata font-medium uppercase tracking-label text-brand">
        404
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        This research URL is unavailable. Return home or open the prediction
        archive.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href={home} className="btn-primary">
          Go home
        </Link>
        <Link href={`${home}/archive`} className="btn-ghost">
          Archive
        </Link>
        <Link href={`${home}/search`} className="btn-ghost">
          Search
        </Link>
      </div>
    </div>
  );
}
