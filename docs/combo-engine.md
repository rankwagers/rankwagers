# Evidence Combo Engine (Sprint 16 Phase A)

Domain library: `lib/combo/`

## Entry points

- `generateEvidenceCombo()` — primary optimizer
- `apiGenerateCombo` / `apiReplaceSelection` / `apiRemoveSelection` / `apiMatchOperators` — Phase B thin API wrappers
- Prepared data: `setPreparedComboData` / `prepareComboData` (Phase C SSR boundary)

## Supported markets

| Preference | List kind | Odds key |
|---|---|---|
| `over_1_5` | over15 | over15 |
| `over_2_5` | over25 | over25 |
| `first_half_goals` | fh | fh |
| `second_half_goals` | sh | sh |
| `mixed` | all enabled | — |

Unsupported prefs are rejected when they are the only selection: BTTS, home/away win, double chance, draw no bet.

## Pipeline

1. Validate request against platform odds bounds and enabled markets
2. Build candidates from prepared fixtures + odds lookup
3. Evidence / coverage / sample proxy gates
4. Correlation filters (competition, country, kickoff window)
5. Score + optimize to target range
6. Alternatives + operator matching

## Sample honesty

Daily-list rows use `LIST_EVIDENCE_SAMPLE_PROXY` when fixture research is absent. UI must label this as a proxy, not a full season sample.

## Phase D integration

- Bookmaker quotes retained server-side (`bookmaker-quotes.ts`) — not shipped to the client
- Availability via `operator-availability.ts` (confidence-gated)
- Ranking: full > partial > unknown; commercial priority bounded
- Deeplinks / attribution / postbacks: see operator-* and affiliate-* docs

## Non-goals

No AI tips, no fabricated odds, no unsupported market adapters, no live bookmaker scraping, no estimated FTDs.
