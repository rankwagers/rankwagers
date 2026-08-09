import path from "node:path";
import { createFileEvidenceArchive, resolveEvidenceArchiveDir } from "@/lib/archive/evidence/file";
import type {
  EvidenceArchiveStore,
  EvidenceAppendResult,
} from "@/lib/archive/evidence/store";
import type { EvidenceSnapshot } from "@/types/evidence";

/* ============================================================================
   SETTLEMENT ACTIVATION — the 2E-A composition, runnable
   ----------------------------------------------------------------------------
   Three modes, selected by environment, FAIL-CLOSED at every fork:

     OFF      today. Missing, empty, or UNKNOWN mode values are OFF — a typo
              in an env file can only turn settlement further off.
     DRY-RUN  the full pipeline executes against the real snapshots, and every
              validation write is redirected to a physically separate dry-run
              store. The append-only record and every public page remain
              byte-identical. This is the evidence-gathering state.
     CANARY   real validations for a BOUNDED, explicitly named competition
              subset; every other fixture still runs dry-run. An empty or
              missing subset list settles NOTHING for real — the boundary
              fails closed to dry-run, never open.

   The master flag (`EVIDENCE_SETTLEMENT_ENABLED`) still gates the job itself
   inside the runner; the mode only ever decides WHERE writes go. Both must be
   deliberately set for a single real validation to exist.

   THE DRY-RUN STORE IS A SPLIT, NOT A COPY: snapshot reads delegate to the
   real archive (a dry run must exercise real inputs), validation reads and
   writes bind to the dry-run directory, and snapshot APPENDS ARE REFUSED
   outright — settlement never writes snapshots, and a store that cannot
   write them makes that a property of the composition rather than a habit
   of the caller. Construction throws if the dry-run directory resolves to
   the real archive directory.
   ========================================================================== */

export const SETTLEMENT_ACTIVATION_MODES = ["off", "dry_run", "canary"] as const;
export type SettlementActivationMode = (typeof SETTLEMENT_ACTIVATION_MODES)[number];

export function resolveSettlementActivationMode(
  env: NodeJS.ProcessEnv = process.env
): SettlementActivationMode {
  const raw = env.EVIDENCE_SETTLEMENT_MODE?.trim().toLowerCase();
  return raw === "dry_run" || raw === "canary" ? raw : "off";
}

/** The dry-run store's directory — never the real archive's. */
export function resolveDryRunDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.EVIDENCE_SETTLEMENT_DRYRUN_DIR?.trim();
  const dir = configured && configured.length > 0
    ? configured
    : path.join(process.cwd(), "data", "evidence-archive-dryrun");
  const real = resolveEvidenceArchiveDir(env);
  if (path.resolve(dir) === path.resolve(real)) {
    throw new Error(
      "settlement dry-run refused: EVIDENCE_SETTLEMENT_DRYRUN_DIR resolves to the real evidence archive directory"
    );
  }
  return dir;
}

/**
 * The canary's competition boundary: exact competition names, comma-separated,
 * case-insensitively trimmed. Empty/missing → empty set → nothing settles for real.
 */
export function parseCanaryCompetitions(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env.EVIDENCE_SETTLEMENT_CANARY_COMPETITIONS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0)
  );
}

/** Split store: real snapshots in, dry-run validations out, snapshot appends refused. */
export function createDryRunEvidenceStore(
  realStore: EvidenceArchiveStore,
  env: NodeJS.ProcessEnv = process.env
): EvidenceArchiveStore {
  const dryDir = resolveDryRunDir(env);
  const dryStore = createFileEvidenceArchive({
    ...env,
    EVIDENCE_ARCHIVE_DIR: dryDir,
  });
  return {
    appendSnapshot: async (
      snapshot: EvidenceSnapshot
    ): Promise<EvidenceAppendResult<EvidenceSnapshot>> => ({
      ok: false,
      code: "invalid_record",
      message: `dry-run store refuses snapshot appends (snapshot ${snapshot.id}) — settlement writes validations only`,
    }),
    appendValidation: async (record) => {
      /*
       * REFERENTIAL INTEGRITY WITHOUT TOUCHING THE RECORD. The frozen append rules require the
       * referenced snapshot to exist in the SAME store, so the fixture's real snapshots are
       * lazily MIRRORED (byte-copied, never minted) into the sandbox before the validation
       * lands. The mirror is one-way: the sandbox is disposable, the record is never read
       * differently and never written at all.
       */
      const mirrored = await dryStore.latestSnapshot(record.fixtureId);
      if (!mirrored) {
        const snapshots = await realStore.listSnapshots(record.fixtureId);
        for (const snap of snapshots) {
          await dryStore.appendSnapshot(snap);
        }
      }
      return dryStore.appendValidation(record);
    },
    listSnapshots: (fixtureId, options) => realStore.listSnapshots(fixtureId, options),
    listValidations: (fixtureId, options) => dryStore.listValidations(fixtureId, options),
    latestSnapshot: (fixtureId) => realStore.latestSnapshot(fixtureId),
    nextSequence: (fixtureId) => realStore.nextSequence(fixtureId),
  };
}

/* ============================================================================
   THE CANARY MEASUREMENT PLAN — what "go" means, in numbers.
   ----------------------------------------------------------------------------
   Referenced by docs/plans/settlement-activation-go-no-go.md; the doc quotes
   these constants rather than restating them, so the plan cannot drift from
   the code that measures it.

   Population: DRY-RUN measures every completed fixture in the daily archive,
   every day, for at least MIN_DRY_RUN_DAYS. CANARY measures the named
   competition subset for at least MIN_CANARY_DAYS while the remainder stays
   dry-run.
   ========================================================================== */
export const SETTLEMENT_GO_THRESHOLDS = {
  /** Days of clean dry-run output before a canary may be considered. */
  MIN_DRY_RUN_DAYS: 5,
  /** Days of clean canary output before full open may be considered. */
  MIN_CANARY_DAYS: 7,
  /** Manual audit sample per period: dry-run validations checked against final scores. */
  CORRECTNESS_AUDIT_SAMPLE: 50,
  /** Audited outcomes that must match the final score exactly. */
  CORRECTNESS_MIN_RATE: 1.0,
  /** Torn/partial NDJSON lines in the dry-run store across the whole period. */
  MAX_TORN_LINES: 0,
  /** Immutable-violation and write-failed counts across the whole period. */
  MAX_IMMUTABLE_VIOLATIONS: 0,
  MAX_WRITE_FAILURES: 0,
  /** Share of considered candidates ending void/unsupported (excluding deferred markets). */
  MAX_VOID_RATE: 0.1,
  /** Share of candidates deferred by the deadline across the period — headroom, not luck. */
  MAX_DEADLINE_DEFERRAL_RATE: 0.05,
} as const;
