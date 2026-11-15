import { LEG_IDS, type LegId, type OrderLegRow } from './orderLegs';

export type LegChip = 'all' | 'delivered' | 'cancelled' | 'in_flight' | 'has_red' | 'batched';

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

export type LegSortKey =
  | 'order'
  | 'status'
  | 'created'
  | 'units'
  | 'km'
  | LegId
  | 'item_pred'
  | 'lm_pred'
  | 'pred_e2e'
  | 'actual_e2e';

export type LegSortDir = 'asc' | 'desc';

export type LegSort = { key: LegSortKey; dir: LegSortDir };

const TEXT_SORT_KEYS = new Set<LegSortKey>(['order', 'status']);

/** First click: A→Z for text, newest or largest first for times and numbers. */
export function defaultLegSortDir(key: LegSortKey): LegSortDir {
  return TEXT_SORT_KEYS.has(key) ? 'asc' : 'desc';
}

export function nextLegSort(current: LegSort | null, key: LegSortKey): LegSort {
  if (current?.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: defaultLegSortDir(key) };
}

function legSeconds(row: OrderLegRow, id: LegId): number | null {
  return row.legs.find((leg) => leg.id === id)?.actualSeconds ?? null;
}

function numericSortValue(row: OrderLegRow, key: LegSortKey): number | null {
  switch (key) {
    case 'units':
      return row.units;
    case 'km':
      return row.distanceKm;
    case 'item_pred':
      return row.itemPredictedMinutes;
    case 'lm_pred':
      return row.lastMilePredictedMinutes;
    case 'pred_e2e':
      return row.predictedE2eMinutes;
    case 'actual_e2e':
      return row.actualE2eSeconds;
    default:
      if ((LEG_IDS as readonly string[]).includes(key)) return legSeconds(row, key as LegId);
      return null;
  }
}

function compareNullableNumber(a: number | null, b: number | null, dir: LegSortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const delta = a - b;
  return dir === 'asc' ? delta : -delta;
}

function compareText(a: string, b: string, dir: LegSortDir): number {
  const delta = a.localeCompare(b);
  return dir === 'asc' ? delta : -delta;
}

/** Missing numbers and unparseable times stay last in either direction. */
export function sortLegRows(rows: OrderLegRow[], sort: LegSort | null): OrderLegRow[] {
  if (sort == null) return rows;
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    if (sort.key === 'order') return compareText(a.orderNumber, b.orderNumber, sort.dir);
    if (sort.key === 'status') return compareText(a.status, b.status, sort.dir);
    if (sort.key === 'created') {
      const aMs = Date.parse(a.createdAt);
      const bMs = Date.parse(b.createdAt);
      return compareNullableNumber(Number.isNaN(aMs) ? null : aMs, Number.isNaN(bMs) ? null : bMs, sort.dir);
    }
    return compareNullableNumber(numericSortValue(a, sort.key), numericSortValue(b, sort.key), sort.dir);
  });
  return sorted;
}

export function filterLegRows(rows: OrderLegRow[], chip: LegChip): OrderLegRow[] {
  if (chip === 'all') return rows;
  if (chip === 'delivered') return rows.filter((row) => row.status === 'DELIVERED');
  // Order Java status only — trip `inactive` is not customer-cancelled.
  if (chip === 'cancelled') return rows.filter((row) => row.status === 'CANCELLED');
  if (chip === 'in_flight') {
    return rows.filter((row) => row.status !== 'DELIVERED' && row.status !== 'CANCELLED');
  }
  if (chip === 'batched') return rows.filter((row) => row.batched);
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
