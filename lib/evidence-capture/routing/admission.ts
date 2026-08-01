/**
 * Archive admission (Sprint 23B, M4).
 *
 * Thin, injectable helpers that normalize a fetched result into a provider-archive
 * input (M2) or an odds-archive record (M3) and append it, propagating the archive's
 * own categorized result verbatim. They reinterpret NEITHER archive as evidence, add
 * NO evidence semantics, and fabricate NOTHING — a build failure surfaces as
 * `invalid_record`; the archives' `immutable_violation`/`write_failed`/duplicate
 * outcomes pass through unchanged. Stores are passed as interfaces, so nothing
 * server-only is imported here.
 */

import {
  buildProviderArchiveRecord,
  type BuildProviderArchiveInput,
} from "../provider-archive";
import type {
  ProviderArchiveAppendResult,
  ProviderArchiveStore,
} from "../provider-archive/store";
import {
  buildOddsRecord,
  type BuildOddsRecordInput,
} from "../odds-archive";
import type {
  OddsArchiveAppendResult,
  OddsArchiveStore,
} from "../odds-archive/store";

/** Build + append a normalized provider input; provider failures never fabricate data. */
export async function admitProviderArchive(
  store: ProviderArchiveStore,
  input: BuildProviderArchiveInput
): Promise<ProviderArchiveAppendResult> {
  const built = buildProviderArchiveRecord(input);
  if (!built.ok) {
    return {
      ok: false,
      code: "invalid_record",
      message: built.errors.join("; "),
    };
  }
  return store.append(built.record);
}

/** Build + append an odds observation; propagates the odds archive's outcome. */
export async function admitOddsArchive(
  store: OddsArchiveStore,
  input: BuildOddsRecordInput
): Promise<OddsArchiveAppendResult> {
  const built = buildOddsRecord(input);
  if (!built.ok) {
    return {
      ok: false,
      code: "invalid_record",
      message: built.errors.join("; "),
    };
  }
  return store.append(built.record);
}
