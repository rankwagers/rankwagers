/**
 * Validation domain barrel (Sprint 23).
 *
 * SERVER / NODE ONLY — `records.ts` and `integrity.ts` import `node:crypto` via the
 * evidence hashing module. Client Components should import `./states` directly, which
 * is pure.
 */

export * from "./integrity";
export * from "./records";
export * from "./states";
