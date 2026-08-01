"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "global_error_boundary",
        message: error.message,
        digest: error.digest ?? null,
        ts: new Date().toISOString(),
      })
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f6f3ec",
          color: "#13251f",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div role="alert">
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            RankWagers is temporarily unavailable
          </h1>
          <p style={{ color: "#6d7773", marginBottom: "1.5rem" }}>
            Please refresh the page. If the problem continues, try again shortly.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#0e6b4f",
              color: "#fff",
              border: 0,
              borderRadius: "0.375rem",
              padding: "0.65rem 1.25rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
