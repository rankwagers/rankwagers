import path from "path";

import { adminKey, isAuthorized } from "./adminAuth";

export { adminKey, isAuthorized };

export function applicationsPath(): string {
  return (
    process.env.VIP_APPLICATIONS_PATH ||
    path.join(process.cwd(), "..", "telegram-invite-bots", "data", "vip-applications.json")
  );
}

export function settingsPath(): string {
  return process.env.VIP_SETTINGS_PATH || path.join(process.cwd(), "data", "vip-settings.json");
}
