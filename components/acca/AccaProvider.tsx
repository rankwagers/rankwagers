"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trackAccaEvent } from "@/lib/acca/analytics";
import {
  ACCA_STORAGE_EVENT,
  ACCA_UNDO_LIMIT,
  type AccaSlip,
  type NamedAcca,
} from "@/lib/acca/types";
import {
  loadAccaSlip,
  loadNamedAccas,
  saveAccaSlip,
  saveNamedAcca as persistNamed,
  deleteNamedAcca as persistDeleteNamed,
} from "@/lib/acca/persistence";
import {
  addSelection,
  clearSlip,
  emptySlip,
  mergeSelections,
  removeSelection,
  renameSlip,
  replaceSelections,
  setStake,
  type AccaBulkTransferResult,
  type AccaSelectionDraft,
} from "@/lib/acca/rules";
import { trackAccaBuilderEvent } from "@/lib/acca-builder/analytics";
import { assessAccaRisk } from "@/lib/acca/risk";
import { stakeModel } from "@/lib/acca/odds";
import {
  decodeSharePayload,
  slipFromSharePayload,
} from "@/lib/acca/share";

type AccaContextValue = {
  ready: boolean;
  slip: AccaSlip;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  named: NamedAcca[];
  lastError: string | null;
  clearError: () => void;
  add: (draft: AccaSelectionDraft, opts?: { replaceFixture?: boolean; openPanel?: boolean }) => boolean;
  /** Transfer an entire builder combination into Studio. */
  transferBuilder: (
    drafts: readonly AccaSelectionDraft[],
    mode: "merge" | "replace",
    opts?: { openPanel?: boolean }
  ) => AccaBulkTransferResult;
  remove: (selectionId: string) => void;
  clear: () => void;
  undo: () => void;
  canUndo: boolean;
  updateStake: (stake: number) => void;
  rename: (name: string | null) => void;
  saveNamed: (name: string) => void;
  loadNamed: (id: string) => void;
  deleteNamed: (id: string) => void;
  risk: ReturnType<typeof assessAccaRisk>;
  stake: ReturnType<typeof stakeModel>;
};

const AccaContext = createContext<AccaContextValue | null>(null);

export function AccaProvider({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [slip, setSlip] = useState<AccaSlip>(() => emptySlip(locale));
  const [panelOpen, setPanelOpen] = useState(false);
  const [named, setNamed] = useState<NamedAcca[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<AccaSlip[]>([]);
  const hydrated = useRef(false);

  const commit = useCallback((next: AccaSlip, previous?: AccaSlip) => {
    if (previous) {
      setUndoStack((stack) => [...stack, previous].slice(-ACCA_UNDO_LIMIT));
    }
    setSlip(next);
    saveAccaSlip(next);
  }, []);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let initial = loadAccaSlip(locale);
    setNamed(loadNamedAccas());

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const share = params.get("share");
      if (share) {
        const payload = decodeSharePayload(share);
        if (payload) {
          initial = slipFromSharePayload(payload, locale);
          saveAccaSlip(initial);
          setPanelOpen(true);
          trackAccaEvent("acca_opened", {
            locale,
            slip: initial,
            properties: { source: "share" },
          });
        }
      }
    }

    setSlip(initial);
    setReady(true);
  }, [locale]);

  useEffect(() => {
    const onStorage = () => {
      setSlip(loadAccaSlip(locale));
      setNamed(loadNamedAccas());
    };
    window.addEventListener(ACCA_STORAGE_EVENT, onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACCA_STORAGE_EVENT, onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [locale]);

  const add = useCallback(
    (
      draft: AccaSelectionDraft,
      opts?: { replaceFixture?: boolean; openPanel?: boolean }
    ) => {
      const result = addSelection(slip, draft, {
        replaceFixture: opts?.replaceFixture,
      });
      if (!result.ok) {
        setLastError(result.message);
        return false;
      }
      if (result.action === "already_present") {
        setLastError("Already in your Acca.");
        if (opts?.openPanel !== false) setPanelOpen(true);
        return true;
      }
      commit(result.slip, slip);
      setLastError(null);
      trackAccaEvent("acca_selection_added", {
        locale,
        slip: result.slip,
        fixture_id: draft.matchId,
        market: draft.marketKey,
        properties: { action: result.action, source: draft.source },
      });
      if (opts?.openPanel !== false) setPanelOpen(true);
      return true;
    },
    [commit, locale, slip]
  );

  const transferBuilder = useCallback(
    (
      drafts: readonly AccaSelectionDraft[],
      mode: "merge" | "replace",
      opts?: { openPanel?: boolean }
    ): AccaBulkTransferResult => {
      const result =
        mode === "replace"
          ? replaceSelections(slip, drafts)
          : mergeSelections(slip, drafts, { replaceFixture: true });
      if (!result.ok) {
        setLastError(result.message ?? "Transfer failed.");
        return result;
      }
      commit(result.slip, slip);
      setLastError(null);
      trackAccaBuilderEvent(
        mode === "replace"
          ? "acca_builder_replace_selected"
          : "acca_builder_merge_selected",
        {
          locale,
          properties: {
            added: result.added,
            skipped: result.skipped,
            legs: drafts.length,
          },
        }
      );
      trackAccaBuilderEvent("acca_builder_added_to_studio", {
        locale,
        properties: { mode, added: result.added, legs: drafts.length },
      });
      if (opts?.openPanel !== false) setPanelOpen(true);
      return result;
    },
    [commit, locale, slip]
  );

  const remove = useCallback(
    (selectionId: string) => {
      const next = removeSelection(slip, selectionId);
      commit(next, slip);
      trackAccaEvent("acca_selection_removed", {
        locale,
        slip: next,
        properties: { selection_id: selectionId },
      });
    },
    [commit, locale, slip]
  );

  const clear = useCallback(() => {
    const next = clearSlip(slip);
    commit(next, slip);
    trackAccaEvent("acca_cleared", { locale, slip: next });
  }, [commit, locale, slip]);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setSlip(prev);
      saveAccaSlip(prev);
      trackAccaEvent("acca_undo", { locale, slip: prev });
      return stack.slice(0, -1);
    });
  }, [locale]);

  const updateStake = useCallback(
    (stakeValue: number) => {
      const next = setStake(slip, stakeValue);
      commit(next, slip);
      trackAccaEvent("acca_stake_entered", {
        locale,
        slip: next,
        properties: { stake: next.stake },
      });
    },
    [commit, locale, slip]
  );

  const rename = useCallback(
    (name: string | null) => {
      commit(renameSlip(slip, name), slip);
    },
    [commit, slip]
  );

  const saveNamed = useCallback(
    (name: string) => {
      const list = persistNamed(name, renameSlip(slip, name));
      setNamed(list);
      trackAccaEvent("acca_named_saved", {
        locale,
        slip,
        properties: { name },
      });
    },
    [locale, slip]
  );

  const loadNamed = useCallback(
    (id: string) => {
      const entry = named.find((n) => n.id === id);
      if (!entry) return;
      commit(entry.slip, slip);
      setPanelOpen(true);
      trackAccaEvent("acca_named_loaded", {
        locale,
        slip: entry.slip,
        properties: { name: entry.name },
      });
    },
    [commit, locale, named, slip]
  );

  const deleteNamed = useCallback((id: string) => {
    setNamed(persistDeleteNamed(id));
  }, []);

  const openPanel = useCallback(
    (open: boolean) => {
      setPanelOpen(open);
      if (open) {
        trackAccaEvent("acca_opened", { locale, slip });
      }
    },
    [locale, slip]
  );

  const value = useMemo<AccaContextValue>(
    () => ({
      ready,
      slip,
      panelOpen,
      setPanelOpen: openPanel,
      named,
      lastError,
      clearError: () => setLastError(null),
      add,
      transferBuilder,
      remove,
      clear,
      undo,
      canUndo: undoStack.length > 0,
      updateStake,
      rename,
      saveNamed,
      loadNamed,
      deleteNamed,
      risk: assessAccaRisk(slip.selections),
      stake: stakeModel(slip.selections, slip.stake),
    }),
    [
      ready,
      slip,
      panelOpen,
      openPanel,
      named,
      lastError,
      add,
      transferBuilder,
      remove,
      clear,
      undo,
      undoStack.length,
      updateStake,
      rename,
      saveNamed,
      loadNamed,
      deleteNamed,
    ]
  );

  return <AccaContext.Provider value={value}>{children}</AccaContext.Provider>;
}

export function useAcca(): AccaContextValue {
  const ctx = useContext(AccaContext);
  if (!ctx) {
    throw new Error("useAcca must be used within AccaProvider");
  }
  return ctx;
}

/** Safe hook when Acca chrome may be absent (tests / isolated trees). */
export function useAccaOptional(): AccaContextValue | null {
  return useContext(AccaContext);
}
