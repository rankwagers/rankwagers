"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorBand } from "@/components/v3/home/EditorBand";
import { EmptyStateV3, IllustrationEditorEmpty } from "@/components/v3/illustrations";
import { Icon } from "@/components/v3/Icon";
import {
  SENTENCE_MAX,
  validateEditorPicksDocument,
  type EditorPickRecord,
  type EditorPicksDocument,
  type EditorPicksIssue,
} from "@/lib/editor-picks/contracts";
import type { EditorPickView, PickCardPreview } from "@/lib/v3/editorPicks.server";
import { predictionsEn } from "@/lib/translations/predictionsEn";

/* ============================================================================
   THE FEATURED PICKS MANAGER (Bible V3, block F — the admin surface).

   The editor authors WORDS and a WINDOW; every number on the previewed card
   is the engine's (the same derivation the public band uses, served by the
   admin API as a preview). The compliance panel runs the same pure validator
   the write endpoint enforces, so what the panel calls clean, the save
   accepts — and a banned claim is caught while typing, not at publish.

   Admin is an EN surface (as the rest of /admin); readers meet the picks
   through the localized band, never through this page.
   ========================================================================== */

type BoardFixture = {
  matchId: number;
  home: string;
  away: string;
  league: string;
  countryCode: string | null;
  kickoffTime: number;
};

type FeaturedPayload = {
  ok: boolean;
  document: EditorPicksDocument;
  issues: EditorPicksIssue[];
  fixtures: BoardFixture[];
  boardError: string | null;
  operators: Array<{ slug: string; name: string }>;
  previews: PickCardPreview[];
};

const p = predictionsEn;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function FeaturedPicksManager() {
  const [doc, setDoc] = useState<EditorPicksDocument | null>(null);
  const [fixtures, setFixtures] = useState<BoardFixture[]>([]);
  const [operators, setOperators] = useState<Array<{ slug: string; name: string }>>([]);
  const [previews, setPreviews] = useState<Map<number, PickCardPreview>>(new Map());
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("");
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "ready" }
    | { kind: "saving" }
    | { kind: "saved"; at: string }
    | { kind: "error"; message: string }
  >({ kind: "loading" });
  const dragIndex = useRef<number | null>(null);

  const load = useCallback(async (extraFixtureIds: number[] = []) => {
    const search = extraFixtureIds.length ? `?fixtures=${extraFixtureIds.join(",")}` : "";
    const res = await fetch(`/api/admin/featured${search}`, { cache: "no-store" });
    if (!res.ok) {
      setStatus({ kind: "error", message: `load failed (${res.status})` });
      return;
    }
    const payload = (await res.json()) as FeaturedPayload;
    setDoc((current) => current ?? payload.document);
    setFixtures(payload.fixtures);
    setOperators(payload.operators);
    setPreviews((current) => {
      const next = new Map(current);
      for (const preview of payload.previews) next.set(preview.matchId, preview);
      return next;
    });
    setStatus((current) => (current.kind === "loading" ? { kind: "ready" } : current));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issues = useMemo(
    () => (doc ? validateEditorPicksDocument(doc) : []),
    [doc]
  );

  const orderedPicks = useMemo(() => {
    if (!doc) return [] as EditorPickRecord[];
    const byId = new Map(doc.picks.map((pick) => [pick.id, pick]));
    return doc.order
      .map((id) => byId.get(id))
      .filter((pick): pick is EditorPickRecord => Boolean(pick));
  }, [doc]);

  const previewCards: EditorPickView[] = useMemo(
    () =>
      orderedPicks.flatMap((pick) => {
        const preview = previews.get(pick.matchId);
        if (!preview || !preview.ok) return [];
        return [
          {
            ...preview,
            sentence: pick.sentence || "…",
            hasLongNote: Boolean(pick.longNote?.trim()),
            isManual: true,
            bestOdds: null,
            fallbackOdds: null,
          },
        ];
      }),
    [orderedPicks, previews]
  );

  const skipped = orderedPicks.filter((pick) => {
    const preview = previews.get(pick.matchId);
    return preview && !preview.ok;
  });

  const leagues = useMemo(
    () => [...new Set(fixtures.map((fixture) => fixture.league))].sort(),
    [fixtures]
  );

  const filteredFixtures = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const taken = new Set(orderedPicks.map((pick) => pick.matchId));
    return fixtures
      .filter((fixture) => !taken.has(fixture.matchId))
      .filter((fixture) => !league || fixture.league === league)
      .filter(
        (fixture) =>
          !needle ||
          `${fixture.home} ${fixture.away} ${fixture.league}`.toLowerCase().includes(needle)
      )
      .slice(0, 30);
  }, [fixtures, query, league, orderedPicks]);

  const mutate = (next: (current: EditorPicksDocument) => EditorPicksDocument) => {
    setDoc((current) => (current ? next(current) : current));
    setStatus((current) =>
      current.kind === "saved" ? { kind: "ready" } : current
    );
  };

  const addPick = (fixture: BoardFixture) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    mutate((current) => ({
      ...current,
      order: [...current.order, id],
      picks: [
        ...current.picks,
        {
          id,
          matchId: fixture.matchId,
          sentence: "",
          longNote: null,
          startsAt: null,
          endsAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    if (!previews.has(fixture.matchId)) void load([fixture.matchId]);
  };

  const removePick = (id: string) =>
    mutate((current) => ({
      ...current,
      order: current.order.filter((entry) => entry !== id),
      picks: current.picks.filter((pick) => pick.id !== id),
    }));

  const updatePick = (id: string, patch: Partial<EditorPickRecord>) =>
    mutate((current) => ({
      ...current,
      picks: current.picks.map((pick) => (pick.id === id ? { ...pick, ...patch } : pick)),
    }));

  const move = (from: number, to: number) =>
    mutate((current) => {
      if (to < 0 || to >= current.order.length) return current;
      const order = [...current.order];
      const [entry] = order.splice(from, 1);
      order.splice(to, 0, entry);
      return { ...current, order };
    });

  const save = async () => {
    if (!doc) return;
    setStatus({ kind: "saving" });
    const res = await fetch("/api/admin/featured", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: doc }),
    });
    if (res.status === 422) {
      setStatus({ kind: "error", message: "validation failed — see the compliance panel" });
      return;
    }
    if (!res.ok) {
      setStatus({ kind: "error", message: `save failed (${res.status})` });
      return;
    }
    const payload = (await res.json()) as { document: EditorPicksDocument };
    setDoc(payload.document);
    setStatus({ kind: "saved", at: new Date().toISOString() });
  };

  if (status.kind === "loading" || !doc) {
    return (
      <p className="rw3-meta" style={{ padding: 20 }}>
        Loading the board…
      </p>
    );
  }

  const fixtureFor = (matchId: number) => fixtures.find((f) => f.matchId === matchId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "14px 20px 40px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h1 className="rw3-title" style={{ margin: 0 }}>
          Featured picks
        </h1>
        <span className="rw3-meta">
          The band renders the first 4 active picks in this order; empty slots auto-fill from
          the engine.
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 10, alignItems: "center" }}>
          {status.kind === "saved" ? <span className="rw3-meta">saved</span> : null}
          {status.kind === "error" ? (
            <span className="rw3-meta" style={{ color: "var(--loss)" }}>
              {status.message}
            </span>
          ) : null}
          <button
            type="button"
            className="rw3-filled"
            style={{ padding: "5px 14px", fontSize: 12 }}
            disabled={status.kind === "saving" || issues.length > 0}
            onClick={() => void save()}
          >
            {status.kind === "saving" ? "Saving…" : "Save"}
          </button>
        </span>
      </header>

      {/* ── the selection ──────────────────────────────────────────────── */}
      {orderedPicks.length === 0 ? (
        <EmptyStateV3
          illustration={<IllustrationEditorEmpty />}
          title={p.v3EmptyEditorTitle}
          line={p.v3EmptyEditorLine}
        />
      ) : (
        <ol style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0 }}>
          {orderedPicks.map((pick, index) => {
            const fixture = fixtureFor(pick.matchId);
            const preview = previews.get(pick.matchId);
            const sentenceLength = pick.sentence.trim().length;
            return (
              <li
                key={pick.id}
                draggable
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current !== null) move(dragIndex.current, index);
                  dragIndex.current = null;
                }}
                style={{
                  listStyle: "none",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  background: "var(--surface)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--muted)", cursor: "grab", display: "inline-flex" }}>
                    <Icon name="drag" size={14} />
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {fixture ? `${fixture.home} – ${fixture.away}` : `#${pick.matchId}`}
                  </span>
                  <span className="rw3-meta">{fixture?.league ?? "off today's board"}</span>
                  {preview && !preview.ok ? (
                    <span className="rw3-meta" style={{ color: "var(--loss)" }}>
                      will not render: {preview.reason === "off_board" ? "off the board" : "no qualifying signal"}
                    </span>
                  ) : null}
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
                    <button type="button" className="rw3-ghost" style={{ padding: "1px 7px" }} onClick={() => move(index, index - 1)} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" className="rw3-ghost" style={{ padding: "1px 7px" }} onClick={() => move(index, index + 1)} aria-label="Move down">
                      ↓
                    </button>
                    <button type="button" className="rw3-ghost" style={{ padding: "1px 7px" }} onClick={() => removePick(pick.id)} aria-label="Remove pick">
                      <Icon name="close" size={11} />
                    </button>
                  </span>
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="rw3-label">
                    Sentence ·{" "}
                    <span style={{ color: sentenceLength > SENTENCE_MAX ? "var(--loss)" : "var(--muted)" }}>
                      {sentenceLength}/{SENTENCE_MAX}
                    </span>
                  </span>
                  <input
                    type="text"
                    value={pick.sentence}
                    maxLength={SENTENCE_MAX + 20}
                    onChange={(event) => updatePick(pick.id, { sentence: event.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="rw3-label">Long note (fixture page&apos;s editor note — optional)</span>
                  <textarea
                    value={pick.longNote ?? ""}
                    rows={2}
                    onChange={(event) =>
                      updatePick(pick.id, { longNote: event.target.value || null })
                    }
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="rw3-label">Visible from</span>
                    <input
                      type="datetime-local"
                      value={toLocalInput(pick.startsAt)}
                      onChange={(event) =>
                        updatePick(pick.id, { startsAt: fromLocalInput(event.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="rw3-label">Until</span>
                    <input
                      type="datetime-local"
                      value={toLocalInput(pick.endsAt)}
                      onChange={(event) =>
                        updatePick(pick.id, { endsAt: fromLocalInput(event.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── the board (search / filter / add) ──────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="rw3-label">Today&apos;s board</span>
          <input
            type="search"
            placeholder="Team or league"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
          <select value={league} onChange={(event) => setLeague(event.target.value)} style={inputStyle}>
            <option value="">All leagues</option>
            {leagues.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {filteredFixtures.map((fixture) => (
            <li
              key={fixture.matchId}
              style={{
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                borderBottom: "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {fixture.home} – {fixture.away}
              </span>
              <span className="rw3-meta">{fixture.league}</span>
              <button
                type="button"
                className="rw3-ghost"
                style={{ marginLeft: "auto", padding: "2px 9px", fontSize: 11 }}
                onClick={() => addPick(fixture)}
              >
                Add
              </button>
            </li>
          ))}
          {filteredFixtures.length === 0 ? (
            <li className="rw3-meta" style={{ listStyle: "none", padding: "6px 0" }}>
              Nothing matches.
            </li>
          ) : null}
        </ul>
      </section>

      {/* ── the pin ────────────────────────────────────────────────────── */}
      <section style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="rw3-label">Offer of the day · pinned operator</span>
        <select
          value={doc.pinnedOperatorSlug ?? ""}
          onChange={(event) =>
            mutate((current) => ({
              ...current,
              pinnedOperatorSlug: event.target.value || null,
            }))
          }
          style={inputStyle}
        >
          <option value="">Ranked default</option>
          {operators.map((operator) => (
            <option key={operator.slug} value={operator.slug}>
              {operator.name}
            </option>
          ))}
        </select>
      </section>

      {/* ── compliance panel ───────────────────────────────────────────── */}
      <section
        aria-label="Compliance check"
        style={{
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span className="rw3-label" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="verified" size={12} />
          Compliance check
        </span>
        {issues.length === 0 && skipped.length === 0 ? (
          <span className="rw3-meta" style={{ color: "var(--win)" }}>
            Clean — every sentence inside the cap, no banned claims, windows sane.
          </span>
        ) : (
          <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            {issues.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className="rw3-meta"
                style={{ listStyle: "none", color: "var(--loss)" }}
              >
                {issue.message}
              </li>
            ))}
            {skipped.map((pick) => (
              <li key={pick.id} className="rw3-meta" style={{ listStyle: "none" }}>
                {fixtureFor(pick.matchId)
                  ? `${fixtureFor(pick.matchId)!.home} – ${fixtureFor(pick.matchId)!.away}`
                  : `#${pick.matchId}`}{" "}
                will be skipped on the band (no sample-backed number to show).
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── live band preview ──────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="rw3-label">Band preview (manual picks only — empty slots auto-fill for readers)</span>
        {previewCards.length ? (
          <div style={{ border: "1px solid var(--line)", borderRadius: 6 }}>
            <EditorBand
              picks={previewCards}
              locale="en"
              strings={{
                editorPick: p.v3EditorPick,
                more: p.v3More,
                sponsored: p.v3Sponsored18,
                strongestSignals: p.v3StrongestSignals,
                marketLabels: {
                  fh: p.v3MktFh,
                  over15: p.v3MktOver15,
                  over25: p.v3MktOver25,
                  sh: p.v3MktSh,
                },
              }}
            />
          </div>
        ) : (
          <span className="rw3-meta">No renderable manual picks yet.</span>
        )}
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 13,
  padding: "5px 8px",
};
