export type OddsHistoryRecord = {
  fixtureId: number;
  operatorId: number;
  operatorName: string;
  market: string;
  line: string;
  odd: number;
  timestamp: string;
};

export type OddsHistoryQuery = {
  fixtureId?: number;
  operatorId?: number;
  market?: string;
  /** Reserved for future league-scoped queries (no league column yet). */
  league?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type OddsChartRange = "24h" | "12h" | "6h" | "1h" | "live";

export type OddsChartView = "decimal" | "implied" | "percent_change";

export type OddsMovementSeverity = "minor" | "medium" | "major" | "steam";

export type OddsMovementDirection = "shortened" | "drifted" | "unchanged";

export type OddsTimelinePoint = {
  kind: "opening" | "historical" | "current" | "closing";
  timestamp: string;
  price: number;
  operatorId: number;
  operatorName: string;
  market: string;
};

export type OddsMovement = {
  operatorId: number;
  operatorName: string;
  market: string;
  fromTimestamp: string;
  toTimestamp: string;
  fromPrice: number;
  toPrice: number;
  percentChange: number;
  direction: OddsMovementDirection;
  severity: OddsMovementSeverity;
  isSteam: boolean;
};

export type BestOddsSnapshot = {
  market: string;
  highest: { operatorId: number; operatorName: string; odd: number } | null;
  lowest: { operatorId: number; operatorName: string; odd: number } | null;
  average: number | null;
  spread: number | null;
  operators: Array<{ operatorId: number; operatorName: string; odd: number }>;
};

export type OperatorOddsComparisonRow = {
  operatorId: number;
  operatorName: string;
  opening: number | null;
  current: number | null;
  closing: number | null;
  difference: number | null;
  movementPercent: number | null;
  movementDirection: OddsMovementDirection;
  coveragePoints: number;
};

export type OddsChartSeriesPoint = {
  timestamp: string;
  value: number;
};

export type OddsChartSeries = {
  operatorId: number;
  operatorName: string;
  points: OddsChartSeriesPoint[];
};

export type ClosingLineDisplay = {
  operatorId: number;
  operatorName: string;
  opening: number;
  current: number;
  closing: number;
  clvPercent: number;
  direction: "positive" | "negative" | "neutral";
};

export type OddsIntelligencePayload = {
  fixtureId: number;
  market: string;
  range: OddsChartRange;
  records: OddsHistoryRecord[];
  timeline: OddsTimelinePoint[];
  movements: OddsMovement[];
  snapshot: BestOddsSnapshot;
  comparison: OperatorOddsComparisonRow[];
  clv: ClosingLineDisplay[];
  chart: {
    view: OddsChartView;
    series: OddsChartSeries[];
  };
};

export interface OddsHistoryStore {
  append(records: readonly OddsHistoryRecord[]): Promise<void>;
  query?(input: OddsHistoryQuery): Promise<OddsHistoryRecord[]>;
}

export interface OddsHistoryReader {
  query(input: OddsHistoryQuery): Promise<OddsHistoryRecord[]>;
}
