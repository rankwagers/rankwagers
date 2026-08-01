import { randomBytes } from "node:crypto";

/**
 * Acca identity (Sprint 20B-B, stage B2).
 *
 * Follows the established convention from `lib/builder-approval/identifiers.ts`: a short
 * prefix plus 128 bits of CSPRNG entropy, rendered lowercase hex.
 *
 * The primary key is NEVER derived from the title or the slug. A title-derived key would
 * make the identity collide exactly when two Accas are most similar, and would leak editorial
 * content into a database key. Slug uniqueness is a separate constraint on a separate column.
 */

export const ACCA_ID_PREFIX = "acca_";
const ACCA_ID_ENTROPY_BYTES = 16;
const ACCA_ID_RE = /^acca_[0-9a-f]{32}$/;

export function mintAccaId(): string {
  return `${ACCA_ID_PREFIX}${randomBytes(ACCA_ID_ENTROPY_BYTES).toString("hex")}`;
}

export function isAccaId(value: unknown): value is string {
  return typeof value === "string" && ACCA_ID_RE.test(value);
}

/**
 * Stable slug collision discriminator for a given Acca.
 *
 * Derived from the Acca id, so it is stable for the whole lifetime of one creation attempt:
 * a retry that reuses the same id produces the same slug, and there is no unbounded retry
 * loop and no fresh random public slug on every attempt.
 */
export function slugDiscriminatorFor(accaId: string): string {
  return accaId.startsWith(ACCA_ID_PREFIX)
    ? accaId.slice(ACCA_ID_PREFIX.length, ACCA_ID_PREFIX.length + 8)
    : accaId.slice(0, 8);
}
