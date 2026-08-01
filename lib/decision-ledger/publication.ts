import "server-only";
import type { DailyArchive, ArchivedRow } from "@/lib/footystats/dailyArchive";
import type { MatchListKind } from "@/lib/footystats/types";
import { confidenceForRow } from "@/lib/archive/markets";
import { appendLedgerEvent } from "./append";
import { buildIdempotencyKey } from "./idempotency";
import { predictionAggregateId } from "./identifiers";
import { readAllEvents } from "./adapters/file";
import {
  CONFIDENCE_NORMALIZATION_VERSION,
  PUBLICATION_SNAPSHOT_VERSION,
} from "./versions";
import { mayRevisePublication } from "./validation";

const TABS: MatchListKind[] = ["fh", "over15", "over25", "sh"];

function kickoffIso(row: ArchivedRow): string | null {
  if (!row.kickoffTime || !Number.isFinite(row.kickoffTime)) return null;
  return new Date(row.kickoffTime * 1000).toISOString();
}

function publicationPayload(
  row: ArchivedRow,
  market: MatchListKind,
  date: string,
  savedAt: string,
  publicationVersion: number,
  publishedAt: string,
  publishedAtProvenance: "EXACT" | "PROXY",
) {
  const confidence = confidenceForRow(row, market);
  return {
    predictionId: `${date}-${market}-${row.matchId}`,
    publicationVersion,
    publicationSnapshotVersion: PUBLICATION_SNAPSHOT_VERSION,
    date,
    matchId: row.matchId,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    competition: row.competition,
    country: row.country ?? null,
    countryCode: row.countryCode ?? null,
    marketKey: market,
    selection: market,
    rawConfidence: confidence,
    normalizedConfidence0to100: confidence,
    confidenceSemantics: "CALIBRATABLE_PROBABILITY",
    confidenceNormalizationVersion: CONFIDENCE_NORMALIZATION_VERSION,
    evidenceSummary: [
      `Qualified list market: ${market}`,
      `Model probability ${confidence}% at publication snapshot`,
    ],
    evidenceCompleteness: "partial_heuristic",
    kickoffAt: kickoffIso(row),
    publishedAt,
    publishedAtProvenance,
    archiveSavedAt: savedAt,
    listResult: row.listResult,
    homeScore: row.homeScore ?? null,
    awayScore: row.awayScore ?? null,
    predictionSource: "footystats_daily_list",
  };
}

/**
 * Append publication / settlement events from a daily archive save.
 * Fail-open from caller. Does not mutate archive files.
 */
export async function recordArchiveSaveToLedger(
  archive: DailyArchive,
  opts?: { requestId?: string | null },
): Promise<{ published: number; settled: number; revised: number; duplicates: number }> {
  const existing = await readAllEvents();
  const byAgg = new Map<string, typeof existing>();
  for (const e of existing) {
    const list = byAgg.get(e.aggregateId) ?? [];
    list.push(e);
    byAgg.set(e.aggregateId, list);
  }

  let published = 0;
  let settled = 0;
  let revised = 0;
  let duplicates = 0;

  for (const market of TABS) {
    for (const row of archive[market]) {
      const aggregateId = predictionAggregateId({
        date: archive.date,
        marketKey: market,
        matchId: row.matchId,
      });
      const prior = byAgg.get(aggregateId) ?? [];
      const priorPubs = prior.filter(
        (e) =>
          e.eventType === "PREDICTION_PUBLISHED" ||
          e.eventType === "PREDICTION_PUBLICATION_REVISED",
      );
      const publicationVersion = priorPubs.length + 1;
      const firstPub = priorPubs[0];
      const publishedAt =
        (firstPub?.payload.publishedAt as string | undefined) ?? archive.savedAt;
      const publishedAtProvenance: "EXACT" | "PROXY" =
        firstPub && firstPub.payload.publishedAtProvenance === "EXACT"
          ? "EXACT"
          : priorPubs.length === 0
            ? "EXACT"
            : "PROXY";

      if (priorPubs.length === 0) {
        const payload = publicationPayload(
          row,
          market,
          archive.date,
          archive.savedAt,
          1,
          archive.savedAt,
          "EXACT",
        );
        const res = await appendLedgerEvent({
          eventType: "PREDICTION_PUBLISHED",
          aggregateType: "prediction",
          aggregateId,
          occurredAt: archive.savedAt,
          source: "daily_archive_save",
          requestId: opts?.requestId ?? null,
          idempotencyKey: buildIdempotencyKey([
            "PREDICTION_PUBLISHED",
            aggregateId,
            "v1",
          ]),
          payload,
          provenanceConfidence: "AUTHORITATIVE",
        });
        if (res.ok && res.appended) published += 1;
        else if (res.ok && !res.appended) duplicates += 1;
      } else {
        const last = priorPubs[priorPubs.length - 1];
        const prevConf = last.payload.rawConfidence;
        const prevResult = last.payload.listResult;
        const confidence = confidenceForRow(row, market);
        const changed =
          prevConf !== confidence || prevResult !== row.listResult;
        if (changed) {
          const gate = mayRevisePublication({
            kickoffAt: kickoffIso(row),
          });
          // Settlement transitions are always allowed; confidence revisions post-kickoff rejected
          const isSettlementOnly =
            prevConf === confidence && prevResult !== row.listResult;
          if (!gate.allowed && !isSettlementOnly) {
            // skip unsupported confidence revision
          } else if (!isSettlementOnly) {
            const payload = publicationPayload(
              row,
              market,
              archive.date,
              archive.savedAt,
              publicationVersion,
              publishedAt,
              publishedAtProvenance,
            );
            const res = await appendLedgerEvent({
              eventType: "PREDICTION_PUBLICATION_REVISED",
              aggregateType: "prediction",
              aggregateId,
              occurredAt: archive.savedAt,
              source: "daily_archive_save",
              requestId: opts?.requestId ?? null,
              idempotencyKey: buildIdempotencyKey([
                "PREDICTION_PUBLICATION_REVISED",
                aggregateId,
                `v${publicationVersion}`,
                String(confidence),
                row.listResult,
              ]),
              payload: {
                ...payload,
                changedFields: ["confidence", "listResult"].filter((f) =>
                  f === "confidence"
                    ? prevConf !== confidence
                    : prevResult !== row.listResult,
                ),
                revisionReason: "archive_resave",
              },
              provenanceConfidence: "DERIVED",
            });
            if (res.ok && res.appended) revised += 1;
            else if (res.ok && !res.appended) duplicates += 1;
          }
        }
      }

      if (row.listResult === "won" || row.listResult === "lost" || row.listResult === "postponed") {
        const outcome =
          row.listResult === "won"
            ? "WON"
            : row.listResult === "lost"
              ? "LOST"
              : "VOID";
        const pubVersion = Math.max(1, priorPubs.length || 1);
        const res = await appendLedgerEvent({
          eventType: "PREDICTION_SETTLEMENT_RECORDED",
          aggregateType: "prediction",
          aggregateId,
          occurredAt: archive.savedAt,
          source: "daily_archive_settlement",
          requestId: opts?.requestId ?? null,
          idempotencyKey: buildIdempotencyKey([
            "PREDICTION_SETTLEMENT_RECORDED",
            aggregateId,
            outcome,
            String(row.homeScore),
            String(row.awayScore),
          ]),
          payload: {
            predictionId: `${archive.date}-${market}-${row.matchId}`,
            publicationVersion: pubVersion,
            outcome,
            listResult: row.listResult,
            homeScore: row.homeScore ?? null,
            awayScore: row.awayScore ?? null,
            settlementSource: "archive_list_result",
            provenanceConfidence: "DERIVED",
            settlementContractVersion: "26.0.0",
          },
          provenanceConfidence: "DERIVED",
        });
        if (res.ok && res.appended) settled += 1;
        else if (res.ok && !res.appended) duplicates += 1;
      }
    }
  }

  return { published, settled, revised, duplicates };
}
