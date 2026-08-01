/**
 * Evidence domain barrel (Sprint 23).
 *
 * SERVER / NODE ONLY — re-exports `snapshot.ts`, `hash.ts`, `identifiers.ts` and
 * `integrity.ts`, which import `node:crypto`. Client Components must import
 * `@/lib/evidence/presentation` and `@/lib/evidence/analytics` directly instead.
 */

export * from "./constants";
export * from "./hash";
export * from "./identifiers";
export * from "./integrity";
export * from "./qualification";
export * from "./score";
export * from "./snapshot";
