"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/logger";

/* Route-level error state for the countries family — Bible V3 idiom. Honest and
   quiet: names what happened, offers retry, promises nothing. Boundary copy is
   hardcoded EN like the root boundary — the dictionary stays out of the client
   bundle. */
export default function CountriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "countries_error_boundary", {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <div role="alert" style={{ padding: "14px 20px 64px" }}>
      <p className="rw3-label" style={{ margin: 0 }}>
        Countries
      </p>
      <h1 className="rw3-title" style={{ margin: "10px 0 0" }}>
        This page failed to render
      </h1>
      <p
        className="max-w-md"
        style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}
      >
        A temporary error interrupted the countries view. Nothing in the
        research record was changed — retry, or come back shortly.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rw3-ghost"
        style={{ marginTop: 24 }}
      >
        Try again
      </button>
    </div>
  );
}
