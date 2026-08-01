import { Pool, type PoolConfig } from "pg";
import type {
  AffiliateClickRecord,
  AffiliateConversionRecord,
  AttributionStore,
  AttributionStoreStats,
} from "./attribution";

type ClickRow = {
  click_id: string;
  session_id: string | null;
  combo_id: string | null;
  operator_id: string;
  country: string | null;
  locale: string;
  placement: string;
  operator_rank: number | null;
  target_odds_min: number | null;
  target_odds_max: number | null;
  actual_combo_odds: number | null;
  operator_combo_odds: number | null;
  selection_count: number | null;
  market_types: string[] | null;
  evidence_strength: string | null;
  availability: AffiliateClickRecord["availability"];
  deeplink_type: string;
  campaign_id: string | null;
  offer_id: string | null;
  idempotency_key: string | null;
  created_at: Date | string;
};

type ConversionRow = {
  conversion_id: string;
  operator_id: string;
  click_id: string | null;
  external_transaction_id: string | null;
  type: string;
  amount: number | null;
  currency: string | null;
  occurred_at: Date | string;
  received_at: Date | string;
  status: AffiliateConversionRecord["status"];
  attributed: boolean;
  raw_reference_hash: string | null;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapClick(row: ClickRow): AffiliateClickRecord {
  return {
    clickId: row.click_id,
    sessionId: row.session_id ?? undefined,
    comboId: row.combo_id ?? undefined,
    operatorId: row.operator_id,
    country: row.country ?? undefined,
    locale: row.locale,
    placement: row.placement,
    operatorRank: row.operator_rank ?? undefined,
    targetOddsMin: row.target_odds_min ?? undefined,
    targetOddsMax: row.target_odds_max ?? undefined,
    actualComboOdds: row.actual_combo_odds ?? undefined,
    operatorComboOdds: row.operator_combo_odds ?? undefined,
    selectionCount: row.selection_count ?? undefined,
    marketTypes: row.market_types ?? undefined,
    evidenceStrength: row.evidence_strength ?? undefined,
    availability: row.availability,
    deeplinkType: row.deeplink_type,
    campaignId: row.campaign_id ?? undefined,
    offerId: row.offer_id ?? undefined,
    createdAt: iso(row.created_at),
    idempotencyKey: row.idempotency_key ?? undefined,
  };
}

function mapConversion(row: ConversionRow): AffiliateConversionRecord {
  return {
    conversionId: row.conversion_id,
    operatorId: row.operator_id,
    clickId: row.click_id ?? undefined,
    externalTransactionId: row.external_transaction_id ?? undefined,
    type: row.type,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    occurredAt: iso(row.occurred_at),
    receivedAt: iso(row.received_at),
    status: row.status,
    attributed: row.attributed,
    rawReferenceHash: row.raw_reference_hash ?? undefined,
  };
}

export function createPostgresAttributionStore(
  connectionString: string,
  config: Omit<PoolConfig, "connectionString"> = {}
): AttributionStore {
  const pool = new Pool({
    connectionString,
    max: 10,
    ...config,
  });

  return {
    async createClick(record) {
      if (record.idempotencyKey) {
        const existing = await pool.query<ClickRow>(
          `SELECT * FROM affiliate_clicks WHERE idempotency_key = $1 LIMIT 1`,
          [record.idempotencyKey]
        );
        if (existing.rows[0]) {
          return { created: false, record: mapClick(existing.rows[0]) };
        }
      }

      const byId = await pool.query<ClickRow>(
        `SELECT * FROM affiliate_clicks WHERE click_id = $1 LIMIT 1`,
        [record.clickId]
      );
      if (byId.rows[0]) {
        return { created: false, record: mapClick(byId.rows[0]) };
      }

      try {
        await pool.query(
          `INSERT INTO affiliate_clicks (
            click_id, session_id, combo_id, operator_id, country, locale, placement,
            operator_rank, target_odds_min, target_odds_max, actual_combo_odds,
            operator_combo_odds, selection_count, market_types, evidence_strength,
            availability, deeplink_type, campaign_id, offer_id, idempotency_key, created_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21
          )`,
          [
            record.clickId,
            record.sessionId ?? null,
            record.comboId ?? null,
            record.operatorId,
            record.country ?? null,
            record.locale,
            record.placement,
            record.operatorRank ?? null,
            record.targetOddsMin ?? null,
            record.targetOddsMax ?? null,
            record.actualComboOdds ?? null,
            record.operatorComboOdds ?? null,
            record.selectionCount ?? null,
            record.marketTypes ? JSON.stringify(record.marketTypes) : null,
            record.evidenceStrength ?? null,
            record.availability,
            record.deeplinkType,
            record.campaignId ?? null,
            record.offerId ?? null,
            record.idempotencyKey ?? null,
            record.createdAt,
          ]
        );
        return { created: true, record };
      } catch (err) {
        // Race on unique idempotency / click_id — return existing
        if (record.idempotencyKey) {
          const again = await pool.query<ClickRow>(
            `SELECT * FROM affiliate_clicks WHERE idempotency_key = $1 LIMIT 1`,
            [record.idempotencyKey]
          );
          if (again.rows[0]) {
            return { created: false, record: mapClick(again.rows[0]) };
          }
        }
        const againId = await pool.query<ClickRow>(
          `SELECT * FROM affiliate_clicks WHERE click_id = $1 LIMIT 1`,
          [record.clickId]
        );
        if (againId.rows[0]) {
          return { created: false, record: mapClick(againId.rows[0]) };
        }
        throw err;
      }
    },

    async getClick(clickId) {
      const result = await pool.query<ClickRow>(
        `SELECT * FROM affiliate_clicks WHERE click_id = $1 LIMIT 1`,
        [clickId]
      );
      return result.rows[0] ? mapClick(result.rows[0]) : null;
    },

    async createConversion(record) {
      if (record.externalTransactionId) {
        const existing = await pool.query<ConversionRow>(
          `SELECT * FROM affiliate_conversions
           WHERE operator_id = $1 AND external_transaction_id = $2
           LIMIT 1`,
          [record.operatorId, record.externalTransactionId]
        );
        if (existing.rows[0]) {
          const mapped = mapConversion(existing.rows[0]);
          return {
            created: false,
            record: { ...mapped, status: "duplicate" },
          };
        }
      }

      try {
        await pool.query(
          `INSERT INTO affiliate_conversions (
            conversion_id, operator_id, click_id, external_transaction_id, type,
            amount, currency, occurred_at, received_at, status, attributed, raw_reference_hash
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            record.conversionId,
            record.operatorId,
            record.clickId ?? null,
            record.externalTransactionId ?? null,
            record.type,
            record.amount ?? null,
            record.currency ?? null,
            record.occurredAt,
            record.receivedAt,
            record.status,
            record.attributed,
            record.rawReferenceHash ?? null,
          ]
        );
        return { created: true, record };
      } catch (err) {
        if (record.externalTransactionId) {
          const existing = await pool.query<ConversionRow>(
            `SELECT * FROM affiliate_conversions
             WHERE operator_id = $1 AND external_transaction_id = $2
             LIMIT 1`,
            [record.operatorId, record.externalTransactionId]
          );
          if (existing.rows[0]) {
            const mapped = mapConversion(existing.rows[0]);
            return {
              created: false,
              record: { ...mapped, status: "duplicate" },
            };
          }
        }
        throw err;
      }
    },

    async listConversions() {
      const result = await pool.query<ConversionRow>(
        `SELECT * FROM affiliate_conversions ORDER BY received_at DESC LIMIT 5000`
      );
      return result.rows.map(mapConversion);
    },

    async purgeExpired(now = Date.now()) {
      const cutoff = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      const result = await pool.query(
        `DELETE FROM affiliate_clicks WHERE created_at < $1`,
        [cutoff]
      );
      return result.rowCount ?? 0;
    },

    async stats(): Promise<AttributionStoreStats> {
      const clicks = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM affiliate_clicks`
      );
      const conversions = await pool.query<{
        total: string;
        attributed: string;
        unattributed: string;
      }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE attributed)::text AS attributed,
           COUNT(*) FILTER (WHERE NOT attributed)::text AS unattributed
         FROM affiliate_conversions`
      );
      const row = conversions.rows[0];
      return {
        clickCount: Number(clicks.rows[0]?.count ?? 0),
        conversionCount: Number(row?.total ?? 0),
        attributedConversions: Number(row?.attributed ?? 0),
        unattributedConversions: Number(row?.unattributed ?? 0),
        adapter: "postgres",
      };
    },
  };
}
