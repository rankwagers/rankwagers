/**
 * Evidence archive barrel (Sprint 23).
 *
 * SERVER / NODE ONLY — `project.ts` and `service.ts` reach into `node:crypto` and the
 * filesystem. Client Components import `@/lib/evidence/presentation`,
 * `@/lib/evidence/analytics` and `@/types/evidence` instead.
 *
 * Note: this is the EVIDENCE archive. The sibling `lib/archive/*` modules are the
 * unrelated daily-results archive and are untouched by Sprint 23.
 */

export * from "./links";
export * from "./memory";
export * from "./project";
export * from "./rules";
export * from "./schema";
export * from "./service";
export type {
  EvidenceAppendErrorCode,
  EvidenceAppendResult,
  EvidenceArchiveStore,
  EvidenceQueryOptions,
} from "./store";
