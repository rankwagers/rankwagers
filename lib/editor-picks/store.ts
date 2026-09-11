import "server-only";
import { promises as fs } from "fs";
import path from "path";
import {
  emptyEditorPicksDocument,
  type EditorPicksDocument,
} from "./contracts";

/* ============================================================================
   EDITOR PICKS — the store (Bible V3, block F).

   One JSON document, file-backed with the decision-ledger's atomic idiom
   (tmp + rename): the selection is one editorial decision, not an event
   stream, so a single document IS the honest storage shape — no partial
   states, no merge questions. `EDITOR_PICKS_DIR` overrides the location for
   tests; production and dev share `data/editor-picks/`.

   Reads fail soft to the empty document: a missing or corrupt file must
   degrade to "no manual picks" (the band auto-fills from the engine), never
   to a broken homepage.
   ========================================================================== */

function picksDir(): string {
  const override = process.env.EDITOR_PICKS_DIR?.trim();
  return override || path.join(process.cwd(), "data", "editor-picks");
}

function picksFile(): string {
  return path.join(picksDir(), "picks.json");
}

export async function readEditorPicksDocument(): Promise<EditorPicksDocument> {
  try {
    const raw = await fs.readFile(picksFile(), "utf8");
    const parsed = JSON.parse(raw) as EditorPicksDocument;
    if (parsed?.version !== 1 || !Array.isArray(parsed.picks) || !Array.isArray(parsed.order)) {
      return emptyEditorPicksDocument();
    }
    return parsed;
  } catch {
    return emptyEditorPicksDocument();
  }
}

export async function writeEditorPicksDocument(doc: EditorPicksDocument): Promise<void> {
  await fs.mkdir(picksDir(), { recursive: true });
  const tmp = picksFile() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
  await fs.rename(tmp, picksFile());
}
