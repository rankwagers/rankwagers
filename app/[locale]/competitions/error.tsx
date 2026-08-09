"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/logger";

/* Route-level error state for the competitions family — form-guide idiom. Honest and
   quiet: names what happened, offers retry, promises nothing. Boundary copy is
   hardcoded EN like the root boundary — the dictionary stays out of the client
   bundle. */
export default function CompetitionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "competitions_error_boundary", {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <div
        className="mx-auto max-w-3xl px-4 pt-16"
        role="alert"
      >
        <p className="rw-label">Competitions</p>
        <h1 className="rw-h mt-3 text-2xl">This page failed to render</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--hero-ink-2)]">
          A temporary error interrupted the competitions view. Nothing in the
          research record was changed — retry, or come back shortly.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rw-m mt-8 border border-[var(--hero-ink)] px-5 py-2.5 text-xs uppercase tracking-wider transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)] active:bg-[var(--hero-ink)] active:text-[var(--hero-canvas)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
