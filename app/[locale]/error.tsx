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
      className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center"
      role="alert"
    >
      <p className="rw3-label" style={{ margin: 0 }}>
        Something went wrong
      </p>
      <h1 className="rw3-title" style={{ margin: "10px 0 0" }}>
        We could not render this page
      </h1>
      <p
        className="max-w-md"
        style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}
      >
        A temporary error interrupted this view. Your research data was not lost
        — try again or return home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="rw3-ghost">
          Try again
        </button>
        <Link href={`/${locale}`} className="rw3-ghost">
          Go home
        </Link>
        <Link href={`/${locale}/archive`} className="rw3-ghost">
          Archive
        </Link>
      </div>
      {error.digest ? (
        <p className="rw3-meta font-mono" style={{ margin: "16px 0 0" }}>
          Ref {error.digest}
        </p>
      ) : null}
    </div>
  );
}
