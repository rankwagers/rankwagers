import Link from "next/link";
import { defaultLocale } from "@/lib/i18n";

export default function NotFound() {
  const home = `/${defaultLocale}`;
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas-primary)] px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-metadata font-medium uppercase tracking-label text-brand">
        404
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        This URL is not part of the RankWagers research graph. Check the address
        or return to the homepage to continue.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href={home} className="btn-primary">
          Go home
        </Link>
        <Link href={`${home}/competitions`} className="btn-ghost">
          Browse competitions
        </Link>
        <Link href={`${home}/archive`} className="btn-ghost">
          Prediction archive
        </Link>
      </div>
    </div>
  );
}
