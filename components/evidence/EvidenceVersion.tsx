import { evidenceArchiveTokens } from "@/lib/evidence/presentation";

/**
 * Model / schema / content-hash provenance stamp (Sprint 23).
 *
 * Boundary-neutral: no `"use client"`, no hooks, no Node imports.
 *
 * The content hash is the reader-facing half of the immutability guarantee — it is what
 * lets someone check that a row they saw last month is byte-identical today. It is
 * shown truncated but exposed in full via `title` and `data-content-hash` so it stays
 * copyable and assertable.
 */
export function EvidenceVersion({
  modelVersion,
  schemaVersion,
  contentHash,
  contentHashShort,
  integrityVerified = true,
  className,
}: {
  modelVersion: string;
  schemaVersion?: string;
  contentHash?: string;
  contentHashShort?: string;
  integrityVerified?: boolean;
  className?: string;
}) {
  const shortForm = contentHashShort ?? contentHash?.slice(0, 12) ?? null;

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${evidenceArchiveTokens.mono}${
        className ? ` ${className}` : ""
      }`}
      data-model-version={modelVersion}
      data-content-hash={contentHash ?? undefined}
    >
      <span>
        <span className="sr-only">Model version </span>
        <span aria-hidden="true">Model </span>
        {modelVersion}
      </span>
      {schemaVersion ? (
        <span>
          <span className="sr-only">Schema version </span>
          <span aria-hidden="true">· Schema </span>
          {schemaVersion}
        </span>
      ) : null}
      {shortForm ? (
        <span title={contentHash}>
          <span className="sr-only">Content hash </span>
          <span aria-hidden="true">· </span>
          {shortForm}
        </span>
      ) : null}
      {integrityVerified ? null : (
        <span
          className="text-[var(--red-primary)]"
          data-integrity="failed"
          role="status"
        >
          Integrity check failed
        </span>
      )}
    </span>
  );
}
