import type { ComboCandidate, EvidenceCombo } from "./types";

type StoredComboSession = {
  combo: EvidenceCombo;
  candidates: ComboCandidate[];
  dataSnapshot: string;
  storedAt: number;
};

const store = new Map<string, StoredComboSession>();
const TTL_MS = 30 * 60 * 1000;

function prune(now = Date.now()): void {
  for (const [id, row] of store) {
    if (row.storedAt + TTL_MS <= now) store.delete(id);
  }
}

export function storeComboSession(input: {
  combo: EvidenceCombo;
  candidates: ComboCandidate[];
  dataSnapshot: string;
}): void {
  prune();
  store.set(input.combo.id, {
    combo: input.combo,
    candidates: input.candidates,
    dataSnapshot: input.dataSnapshot,
    storedAt: Date.now(),
  });
}

export function getComboSession(comboId: string): StoredComboSession | null {
  prune();
  return store.get(comboId) ?? null;
}

export function resetComboSessions(): void {
  store.clear();
}
