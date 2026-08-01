import type { ValidationState } from "@/types/evidence";
import {
  evidenceArchiveTokens,
  validationBadgeClass,
} from "@/lib/evidence/presentation";
import {
  validationStateDescription,
  validationStateLabel,
} from "@/lib/validation/states";

/**
 * Validation outcome badge (Sprint 23).
 *
 * Boundary-neutral: no `"use client"`, no hooks, no Node imports — renders in Server
 * and Client Components alike.
 *
 * A11y: the visible label alone reads as a bare word ("Void") to a screen reader with
 * no indication of what it qualifies, so the accessible name spells out the subject and
 * the `title` carries the plain-language meaning.
 */
export function ValidationBadge({
  state,
  revision,
  className,
}: {
  state: ValidationState;
  /** When > 1, the badge marks itself as a corrected record. */
  revision?: number;
  className?: string;
}) {
  const label = validationStateLabel(state);
  const corrected = typeof revision === "number" && revision > 1;
  const accessibleName = corrected
    ? `Validation status: ${label} (corrected, revision ${revision})`
    : `Validation status: ${label}`;

  return (
    <span
      className={`${evidenceArchiveTokens.badge} ${validationBadgeClass(state)}${
        className ? ` ${className}` : ""
      }`}
      data-validation-state={state}
      title={validationStateDescription(state)}
    >
      <span className="sr-only">{accessibleName}</span>
      <span aria-hidden="true">{label}</span>
      {corrected ? (
        <span aria-hidden="true" className="font-mono text-metadata opacity-80">
          r{revision}
        </span>
      ) : null}
    </span>
  );
}
