import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  activeManualPicks,
  emptyEditorPicksDocument,
  validateEditorPicksDocument,
  SENTENCE_MAX,
  type EditorPickRecord,
  type EditorPicksDocument,
} from "../lib/editor-picks/contracts";

/**
 * EDITOR PICKS — block F's domain gate.
 *
 * The validator is the write gate AND the admin panel (one pure function,
 * two callers), so these tests are the contract for both: what blocks a
 * save here is exactly what the panel shows red.
 */

function pick(overrides: Partial<EditorPickRecord> = {}): EditorPickRecord {
  return {
    id: overrides.id ?? "p1",
    matchId: overrides.matchId ?? 100,
    sentence: overrides.sentence ?? "Ten of eleven home matches cleared the line this season.",
    longNote: overrides.longNote ?? null,
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

function doc(picks: EditorPickRecord[], order?: string[]): EditorPicksDocument {
  return {
    version: 1,
    order: order ?? picks.map((entry) => entry.id),
    picks,
    pinnedOperatorSlug: null,
    updatedAt: "2026-09-11T00:00:00.000Z",
  };
}

test("a clean document validates clean", () => {
  assert.deepEqual(validateEditorPicksDocument(doc([pick()])), []);
  assert.deepEqual(validateEditorPicksDocument(emptyEditorPicksDocument()), []);
});

test("the sentence cap is 110 and the counter's law is the validator's", () => {
  const long = pick({ sentence: "x".repeat(SENTENCE_MAX + 1) });
  const issues = validateEditorPicksDocument(doc([long]));
  assert.ok(issues.some((issue) => issue.code === "sentence_too_long"));
  const exactly = pick({ sentence: "x".repeat(SENTENCE_MAX) });
  assert.ok(
    !validateEditorPicksDocument(doc([exactly])).some(
      (issue) => issue.code === "sentence_too_long"
    ),
    "exactly 110 is allowed"
  );
});

test("an empty sentence has nothing to say and is rejected", () => {
  const issues = validateEditorPicksDocument(doc([pick({ sentence: "   " })]));
  assert.ok(issues.some((issue) => issue.code === "sentence_empty"));
});

test("a banned claim blocks the save — in the sentence AND in the long note", () => {
  for (const field of [
    { sentence: "This is a guaranteed win for the hosts." },
    { longNote: "Trust me, a sure win tonight." },
  ]) {
    const issues = validateEditorPicksDocument(doc([pick(field)]));
    assert.ok(
      issues.some((issue) => issue.code === "banned_claim"),
      `expected a banned_claim for ${JSON.stringify(field)}`
    );
  }
});

test("an inverted window is named", () => {
  const issues = validateEditorPicksDocument(
    doc([
      pick({
        startsAt: "2026-09-11T18:00:00.000Z",
        endsAt: "2026-09-11T12:00:00.000Z",
      }),
    ])
  );
  assert.ok(issues.some((issue) => issue.code === "window_inverted"));
});

test("one pick per fixture; order must cover exactly the ids", () => {
  const duplicated = validateEditorPicksDocument(
    doc([pick({ id: "a" }), pick({ id: "b", matchId: 100 })])
  );
  assert.ok(duplicated.some((issue) => issue.code === "duplicate_fixture"));

  const mismatched = validateEditorPicksDocument(doc([pick({ id: "a" })], ["a", "ghost"]));
  assert.ok(mismatched.some((issue) => issue.code === "order_mismatch"));
});

test("activeManualPicks honors the window and the admin order", () => {
  const now = Date.parse("2026-09-11T12:00:00.000Z");
  const document = doc(
    [
      pick({ id: "late", matchId: 1, startsAt: "2026-09-11T15:00:00.000Z" }),
      pick({ id: "open", matchId: 2 }),
      pick({ id: "closed", matchId: 3, endsAt: "2026-09-11T10:00:00.000Z" }),
      pick({ id: "second", matchId: 4 }),
    ],
    ["second", "late", "open", "closed"]
  );
  const active = activeManualPicks(document, now);
  assert.deepEqual(
    active.map((entry) => entry.id),
    ["second", "open"],
    "windowed-out picks vanish; the admin order survives"
  );
});

/* ── the store: atomic round-trip, soft-fail reads ─────────────────────── */

test("the file store round-trips and fails soft to the empty document", async () => {
  process.env.EDITOR_PICKS_DIR = mkdtempSync(path.join(tmpdir(), "editor-picks-"));
  const { readEditorPicksDocument, writeEditorPicksDocument } = await import(
    "../lib/editor-picks/store"
  );

  const before = await readEditorPicksDocument();
  assert.equal(before.picks.length, 0, "missing file reads as the empty document");

  const document = doc([pick()]);
  await writeEditorPicksDocument(document);
  const after = await readEditorPicksDocument();
  assert.deepEqual(after, document);
  delete process.env.EDITOR_PICKS_DIR;
});

/* ── the reader seam: the band builder and the fixture note ────────────── */

test("the fixture page's editor-note seam reads only ACTIVE picks", () => {
  // Source pin: the note comes from activeEditorPickForMatch (window-filtered),
  // never from a raw document read — an expired pick must not keep narrating.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const page = readFileSync(
    path.join(process.cwd(), "app/[locale]/fixtures/[matchId]/page.tsx"),
    "utf8"
  );
  assert.match(page, /activeEditorPickForMatch\(/);
  const view = readFileSync(
    path.join(process.cwd(), "components/fixtures/MatchDetailView.tsx"),
    "utf8"
  );
  assert.match(view, /editorNote\?\.trim\(\)/, "an empty note renders no frame");
  assert.match(view, /p\.v3EditorNote/, "the label is dictionary-born");
});

test("the homepage band is manual-first with engine fill", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const page = readFileSync(path.join(process.cwd(), "app/[locale]/page.tsx"), "utf8");
  assert.match(page, /buildEditorBandPicks\(/, "the block F entry point feeds the band");
  const builder = readFileSync(
    path.join(process.cwd(), "lib/v3/editorPicks.server.ts"),
    "utf8"
  );
  assert.match(builder, /activeManualPicks\(/, "manual picks pass the window filter");
  assert.match(
    builder,
    /if \(!lead\) continue;/,
    "a manual pick without a qualifying signal is skipped, never numberless"
  );
});

test("the admin write endpoint refuses a document the validator rejects", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const route = readFileSync(
    path.join(process.cwd(), "app/api/admin/featured/route.ts"),
    "utf8"
  );
  assert.match(route, /validateEditorPicksDocument\(document\)/);
  assert.match(route, /assertAdminCsrf/, "mutations prove same-origin");
  assert.match(route, /422/, "a validation failure is 422, never a silent write");
});
