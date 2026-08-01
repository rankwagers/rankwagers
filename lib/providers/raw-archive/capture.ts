/**
 * Raw Provider Archive — capture hook (Sprint 23B). The fail-open, flag-gated bridge the provider
 * reliability seam calls. This is the ONLY module that touches a clock, randomness, or storage.
 *
 * GUARANTEES:
 *   - DORMANT by default: `maybeCaptureRawResponse` returns after a single env flag check when the
 *     archive is disabled — no clone, no I/O, no allocation (zero runtime regression).
 *   - FAIL-OPEN: every path is guarded; this module NEVER throws into the provider call and never
 *     changes its result, latency-critically (capture runs fire-and-forget after a sync clone).
 *   - NON-INVASIVE: it clones the Response (never consumes the original body the caller parses).
 *   - REDACTED: provider API keys are scrubbed from the stored body before hashing/persistence.
 *
 * Server-only storage (the file adapter) is loaded via dynamic import so this module and the
 * reliability barrel stay importable without eagerly pulling `server-only`.
 */

import { randomUUID } from "node:crypto";
import {
  buildRawProviderRecord,
  type RawProviderLineage,
} from "./record";
import type { RawProviderArchiveStore } from "./store";
import {
  isRawProviderArchiveEnabled,
  resolveRawArchiveConfig,
  type RawArchiveConfig,
} from "./config";
import { createMemoryRawProviderArchive } from "./memory";

export type RawCaptureContext = {
  provider: string;
  operation: string;
  endpoint?: string;
  lineage?: RawProviderLineage;
};

let memorySingleton: RawProviderArchiveStore | null = null;
let fileStorePromise: Promise<RawProviderArchiveStore> | null = null;

/** In-flight fire-and-forget captures — tracked ONLY so tests can deterministically await them. */
const pending = new Set<Promise<void>>();

function track(p: Promise<void>): void {
  const wrapped = p.catch(() => undefined).finally(() => pending.delete(wrapped));
  pending.add(wrapped);
}

/** Test helper: await all in-flight captures (production never needs to call this). */
export async function flushRawCaptures(): Promise<void> {
  await Promise.all([...pending]);
}

async function resolveStore(
  cfg: RawArchiveConfig
): Promise<RawProviderArchiveStore> {
  if (cfg.adapter === "memory") {
    if (!memorySingleton) memorySingleton = createMemoryRawProviderArchive();
    return memorySingleton;
  }
  if (!fileStorePromise) {
    fileStorePromise = import("./file").then((m) =>
      m.createFileRawProviderArchive()
    );
  }
  return fileStorePromise;
}

/** API keys whose VALUES must never be persisted (redacted from the captured body). */
function providerSecrets(env: NodeJS.ProcessEnv): string[] {
  return [env.FOOTYSTATS_API_KEY, env.API_FOOTBALL_KEY].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
}

/** Byte-bounded UTF-8 prefix (may drop a partial trailing char, replaced safely on decode). */
function truncateUtf8(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) return text;
  return buf.subarray(0, maxBytes).toString("utf8");
}

async function ingest(
  cloned: Response,
  info: {
    provider: string;
    operation: string;
    endpoint?: string;
    httpStatus: number;
    ok: boolean;
    attempts: number;
    durationMs?: number;
    lineage?: RawProviderLineage;
  },
  cfg: RawArchiveConfig,
  env: NodeJS.ProcessEnv
): Promise<void> {
  try {
    let rawBody = "";
    try {
      rawBody = await cloned.text();
    } catch {
      rawBody = "";
    }
    const originalBytes = Buffer.byteLength(rawBody, "utf8");
    const truncated = originalBytes > cfg.maxBodyBytes;
    const body = truncated ? truncateUtf8(rawBody, cfg.maxBodyBytes) : rawBody;

    const built = buildRawProviderRecord({
      provider: info.provider,
      operation: info.operation,
      endpoint: info.endpoint,
      outcome: info.ok ? "ok" : "http_error",
      httpStatus: info.httpStatus,
      ok: info.ok,
      attempts: info.attempts,
      durationMs: info.durationMs,
      capturedAt: new Date().toISOString(),
      body,
      truncated,
      originalBodyBytes: truncated ? originalBytes : undefined,
      secrets: providerSecrets(env),
      nonce: randomUUID(),
      lineage: info.lineage,
    });
    if (!built.ok) return;
    const store = await resolveStore(cfg);
    await store.append(built.record);
  } catch {
    // Fail-open: an archive fault must never surface to the provider call.
  }
}

/**
 * Capture a received provider HTTP response (ok or non-ok). No-op when the archive is disabled.
 * Clones synchronously (before the caller parses `res`) then persists fire-and-forget.
 */
export function maybeCaptureRawResponse(
  ctx: RawCaptureContext,
  res: Response,
  meta: { attempts: number; durationMs?: number },
  env: NodeJS.ProcessEnv = process.env
): void {
  try {
    if (!isRawProviderArchiveEnabled(env)) return; // dormant fast path
    const cfg = resolveRawArchiveConfig(env);
    const cloned = res.clone();
    track(ingest(
      cloned,
      {
        provider: ctx.provider,
        operation: ctx.operation,
        endpoint: ctx.endpoint,
        httpStatus: res.status,
        ok: res.ok,
        attempts: meta.attempts,
        durationMs: meta.durationMs,
        lineage: ctx.lineage,
      },
      cfg,
      env
    ));
  } catch {
    // Fail-open.
  }
}

/**
 * Capture a body-less terminal failure (network error / timeout — no Response). No-op when disabled.
 * Provides lineage completeness so the archive records that a call was attempted and how it failed.
 */
export function maybeCaptureRawFailure(
  ctx: RawCaptureContext,
  meta: { attempts: number; errorCode: string; durationMs?: number },
  env: NodeJS.ProcessEnv = process.env
): void {
  try {
    if (!isRawProviderArchiveEnabled(env)) return; // dormant fast path
    const cfg = resolveRawArchiveConfig(env);
    track((async () => {
      try {
        const built = buildRawProviderRecord({
          provider: ctx.provider,
          operation: ctx.operation,
          endpoint: ctx.endpoint,
          outcome: "network_error",
          httpStatus: null,
          ok: false,
          attempts: meta.attempts,
          durationMs: meta.durationMs ?? 0,
          capturedAt: new Date().toISOString(),
          body: "",
          secrets: providerSecrets(env),
          nonce: randomUUID(),
          lineage: ctx.lineage,
          errorCode: meta.errorCode,
        });
        if (!built.ok) return;
        const store = await resolveStore(cfg);
        await store.append(built.record);
      } catch {
        // Fail-open.
      }
    })());
  } catch {
    // Fail-open.
  }
}

/** Test helper: drop the in-process memory singleton. */
export function resetRawCaptureMemorySingleton(): void {
  memorySingleton = null;
}

/** Test helper: the current in-process memory-adapter singleton (or null if none created). */
export function getRawCaptureMemorySingletonForTest(): RawProviderArchiveStore | null {
  return memorySingleton;
}
