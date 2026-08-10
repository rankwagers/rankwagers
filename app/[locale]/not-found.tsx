import { headers } from "next/headers";
import Link from "next/link";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";

/* The locale-scoped 404 — form-guide register: ink on paper, mono labels,
   bordered actions. Honest and quiet; it names the absence and offers the
   real surfaces, promising nothing. */
export default function LocaleNotFound() {
  const headerLocale = headers().get("x-locale");
  const locale =
    headerLocale && isLocale(headerLocale) ? headerLocale : defaultLocale;
  const home = `/${locale}`;
  const p = getDictionary(locale).predictions;

  return (
    <div
      className="rw-hero container-wide bg-[var(--hero-canvas)]"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-16">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">404</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2rem,4vw,2.6rem)] text-[var(--hero-ink)]">
          {p.nfTitle}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {p.nfBody}
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href={home}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-ink)] px-5 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]"
          >
            {p.nfHome}
          </Link>
          <Link
            href={`${home}/archive`}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-4 text-[var(--hero-ink-2)] transition-colors hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
          >
            {p.arcIndexTitle}
          </Link>
          <Link
            href={`${home}/search`}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-4 text-[var(--hero-ink-2)] transition-colors hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
          >
            {p.srchTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}
