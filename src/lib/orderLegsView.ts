import type { OrderLegRow } from './orderLegs';

export type LegChip = 'all' | 'delivered' | 'cancelled' | 'in_flight' | 'has_red';

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
