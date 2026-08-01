/**
 * Source routing & fetch orchestration (Sprint 23B, M4) — public surface.
 *
 * Dormant, pure/injectable coordination of the upstream source boundaries. It mints
 * no EvidenceSnapshot, derives no score/qualification/markets/signals, performs no
 * real network I/O, and wires no cron/route/flag. Stores are consumed as interfaces,
 * so this barrel imports nothing server-only and is browser/runtime-bundle safe.
 */

export {
  isSourceKind,
  ttlForKind,
  buildFetchPlan,
  type SourceKind,
  type SourceRequest,
  type RoutingRequest,
  type FetchAction,
  type PlannedFetch,
  type FetchPlan,
  type BuildFetchPlanResult,
} from "./sources";

export {
  orchestrateFetches,
  type FetchResult,
  type SourceFetcher,
  type SourceFetchStatus,
  type SourceFetchResult,
  type FetchRunResult,
  type Clock,
} from "./orchestrator";

export { admitProviderArchive, admitOddsArchive } from "./admission";
