import type { StoreStockBrowseItem } from '@/lib/inventoryHealthTypes';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return csvEscape(String(value));
}

const HEADERS = [
  'productId',
  'sku',
  'productName',
  'barcode',
  'currentStock',
  'reservedStock',
  'availableStock',
  'safetyStock',
  'maxStock',
  'availabilityStatus',
  'lowStock',
  'binCount',
  'locations',
  'lastUpdated'
] as const;

function locationsSummary(item: StoreStockBrowseItem): string {
  if (!item.bins?.length) return '';
  return item.bins
    .map((b) => {
      const code = (b.locationCode ?? '').trim() || '—';
      return `${code}:${b.availableStock}`;
    })
    .join('; ');
}

function rowToCsv(r: StoreStockBrowseItem): string[] {
  return [
    cell(r.productId),
    cell(r.sku),
    cell(r.productName),
    cell(r.barcode),
    cell(r.currentStock),
    cell(r.reservedStock),
    cell(r.availableStock),
    cell(r.safetyStock),
    cell(r.maxStock),
    cell(r.availabilityStatus),
    cell(r.lowStock),
    cell(r.binCount),
    cell(locationsSummary(r)),
    cell(r.lastUpdated)
  ];
}

export function storeStockToCsv(items: StoreStockBrowseItem[]): string {
  const lines = [HEADERS.join(',')];
  for (const item of items) {
    lines.push(rowToCsv(item).join(','));
  }
  return lines.join('\n');
}

export function downloadStoreStockCsv(items: StoreStockBrowseItem[], filename = 'store-inventory.csv') {
  const csv = storeStockToCsv(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
