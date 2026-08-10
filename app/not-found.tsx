import Link from "next/link";
import { defaultLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";

/* The root 404 lives outside the [locale] segment, so it speaks the default
   locale — same form-guide register as the locale-scoped page. */
export default function NotFound() {
  const home = `/${defaultLocale}`;
  const p = getDictionary(defaultLocale).predictions;
  return (
    <div
      className="rw-hero flex min-h-screen flex-col justify-center bg-[var(--hero-canvas)] px-6"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto w-full max-w-3xl">
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
            href={`${home}/competitions`}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-4 text-[var(--hero-ink-2)] transition-colors hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
          >
            {p.cmpIndexTitle}
          </Link>
          <Link
            href={`${home}/archive`}
            className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-4 text-[var(--hero-ink-2)] transition-colors hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
          >
            {p.arcIndexTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}
