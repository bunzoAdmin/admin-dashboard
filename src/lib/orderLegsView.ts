import { LEG_IDS, type LegId, type OrderLegRow } from './orderLegs';

export type LegChip = 'all' | 'delivered' | 'cancelled' | 'in_flight' | 'has_red';

export type LegAverage = {
  avgSeconds: number | null;
  sampleCount: number;
};

export type LegAverages = {
  byLeg: Record<LegId, LegAverage>;
  actualE2e: LegAverage;
  orderCount: number;
};

export const PAGE_SIZE = 50;

export function filterLegRows(rows: OrderLegRow[], chip: LegChip): OrderLegRow[] {
  if (chip === 'all') return rows;
  if (chip === 'delivered') return rows.filter((row) => row.status === 'DELIVERED');
  if (chip === 'cancelled') return rows.filter((row) => row.status === 'CANCELLED');
  if (chip === 'in_flight') {
    return rows.filter((row) => row.status !== 'DELIVERED' && row.status !== 'CANCELLED');
  }
  return rows.filter((row) => row.hasRed);
}

export function pageLegRows(rows: OrderLegRow[], page: number, size = PAGE_SIZE): OrderLegRow[] {
  if (page < 0) return [];
  return rows.slice(page * size, page * size + size);
}

function averageSeconds(values: Array<number | null | undefined>): LegAverage {
  let sum = 0;
  let sampleCount = 0;
  for (const value of values) {
    if (value == null) continue;
    sum += value;
    sampleCount += 1;
  }
  return {
    avgSeconds: sampleCount > 0 ? sum / sampleCount : null,
    sampleCount
  };
}

/** Mean leg durations among delivered orders in the row set (e.g. one store day). */
export function computeLegAverages(rows: OrderLegRow[]): LegAverages {
  const delivered = rows.filter((row) => row.status === 'DELIVERED');
  const byLeg = {} as Record<LegId, LegAverage>;
  for (const id of LEG_IDS) {
    byLeg[id] = averageSeconds(delivered.map((row) => row.legs.find((leg) => leg.id === id)?.actualSeconds));
  }
  return {
    byLeg,
    actualE2e: averageSeconds(delivered.map((row) => row.actualE2eSeconds)),
    orderCount: delivered.length
  };
}

export function legAverageHint(avg: LegAverage, deliveredCount: number): string | undefined {
  if (avg.sampleCount === 0 || deliveredCount === 0) return undefined;
  if (avg.sampleCount < deliveredCount) {
    return `${avg.sampleCount} of ${deliveredCount} delivered orders have this leg`;
  }
  return `${deliveredCount} delivered orders`;
}
