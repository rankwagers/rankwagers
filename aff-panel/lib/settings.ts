import fs from "fs";
import path from "path";

import { settingsPath } from "./config";
import { DEFAULT_SETTINGS, type VipSettings } from "./types";

function ensureParent(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readSettings(): VipSettings {
  const p = settingsPath();
  if (!fs.existsSync(p)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<VipSettings>;
    return {
      approvalMessageTemplate:
        data.approvalMessageTemplate ?? DEFAULT_SETTINGS.approvalMessageTemplate,
      defaultVipLink: data.defaultVipLink ?? DEFAULT_SETTINGS.defaultVipLink,
      rejectMessagePrefix:
        data.rejectMessagePrefix ?? DEFAULT_SETTINGS.rejectMessagePrefix,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: VipSettings): void {
  const p = settingsPath();
  ensureParent(p);
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), "utf8");
}

export function renderApprovalMessage(
  template: string,
  vars: Record<string, string>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}
