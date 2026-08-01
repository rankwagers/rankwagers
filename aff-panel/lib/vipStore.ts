import fs from "fs";
import path from "path";

import { applicationsPath } from "./config";
import type { VipApplication, VipStore } from "./types";

function ensureParent(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readStore(): VipStore {
  const p = applicationsPath();
  if (!fs.existsSync(p)) {
    return { applications: [] };
  }
  const raw = fs.readFileSync(p, "utf8");
  if (!raw.trim()) return { applications: [] };
  const data = JSON.parse(raw) as VipStore;
  if (!Array.isArray(data.applications)) return { applications: [] };
  return data;
}

export function writeStore(store: VipStore): void {
  const p = applicationsPath();
  ensureParent(p);
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf8");
}

export function getApplication(id: string): VipApplication | undefined {
  return readStore().applications.find((a) => a.id === id);
}

export function updateApplication(
  id: string,
  patch: Partial<VipApplication>
): VipApplication | null {
  const store = readStore();
  const idx = store.applications.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  store.applications[idx] = {
    ...store.applications[idx],
    ...patch,
    updated_at: now,
  };
  writeStore(store);
  return store.applications[idx];
}

export function listApplications(filter?: VipApplication["status"]): VipApplication[] {
  const apps = readStore().applications;
  const sorted = [...apps].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!filter) return sorted;
  return sorted.filter((a) => a.status === filter);
}
