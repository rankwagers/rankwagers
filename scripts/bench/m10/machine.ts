/**
 * M10 Benchmark Framework — machine / runtime spec capture (Stage 2E, Slice 1).
 *
 * Records the hardware/runtime an artifact was produced on so results are comparable and
 * reproducible across audits. The hostname is one-way hashed — a raw hostname never appears in
 * an artifact. No secrets, no network, no runtime coupling.
 */

import os from "node:os";
import { createHash } from "node:crypto";
import type { MachineSpec } from "./types";

function hashHostname(name: string): string {
  return createHash("sha256").update(name).digest("hex").slice(0, 16);
}

/** Capture the current machine/runtime spec. Deterministic given the host; no clock in identity. */
export function captureMachineSpec(capturedAt: string): MachineSpec {
  const cpus = os.cpus();
  return {
    capturedAt,
    nodeVersion: process.version,
    v8Version: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    osType: os.type(),
    osRelease: os.release(),
    cpuModel: cpus[0]?.model ?? "unknown",
    cpuCount: cpus.length,
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    hostnameHash: hashHostname(os.hostname()),
  };
}
