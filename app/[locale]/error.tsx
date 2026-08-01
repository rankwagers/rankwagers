"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { reportError } from "@/lib/monitoring/logger";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale =
    typeof params?.locale === "string" && params.locale.length > 0
      ? params.locale
      : "en";

  useEffect(() => {
    reportError(error, "locale_error_boundary", {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <div
      className="container-wide flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center"
      role="alert"
    >
      <p className="text-metadata font-medium uppercase tracking-label text-brand">
        Something went wrong
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">
        We could not render this page
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        A temporary error interrupted this view. Your research data was not lost
        — try again or return home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href={`/${locale}`} className="btn-ghost">
          Go home
        </Link>
        <Link href={`/${locale}/archive`} className="btn-ghost">
          Archive
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-4 font-mono text-metadata text-muted-foreground">
          Ref {error.digest}
        </p>
      ) : null}
    </div>
  );
}
