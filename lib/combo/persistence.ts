import type { ComboFormState } from "./clientApi";
import type { PublicEvidenceCombo } from "./apiTypes";

const PREFS_KEY = "rw_combo_prefs_v1";
const COMBO_SESSION_KEY = "rw_combo_session_v1";

export function loadComboPreferences(): Partial<ComboFormState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ComboFormState>;
  } catch {
    return null;
  }
}

export function saveComboPreferences(form: ComboFormState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(form));
  } catch {
    // ignore quota
  }
}

export function loadSessionCombo(): PublicEvidenceCombo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COMBO_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicEvidenceCombo;
  } catch {
    return null;
  }
}

export function saveSessionCombo(combo: PublicEvidenceCombo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!combo) {
      sessionStorage.removeItem(COMBO_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(COMBO_SESSION_KEY, JSON.stringify(combo));
  } catch {
    // ignore
  }
}
