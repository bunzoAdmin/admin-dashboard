import type { ProductResponse } from '@/lib/catalogTypes';

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
  if (Array.isArray(value)) return csvEscape(value.join('; '));
  return csvEscape(String(value));
}

const HEADERS = [
  'id',
  'sku',
  'barcode',
  'name',
  'brand',
  'categoryId',
  'categoryName',
  'basePrice',
  'contentAmount',
  'contentUom',
  'multipackCount',
  'description',
  'shortDescription',
  'slug',
  'images',
  'tags',
  'weightGrams',
  'groupId',
  'isActive',
  'searchKeywords',
  'searchPriority',
  'isBestseller',
  'orderCount',
  'availableQuantity',
  'badgeCodes',
  'badgeLabels',
  'detailsVersion',
  'detailsAbout',
  'storageInstructions',
  'storageShelfLife',
  'storageUseByDate',
  'storageTemperatureBand',
  'nutritionServingSize',
  'nutritionRows',
  'createdAt',
  'updatedAt'
] as const;

function productToRow(p: ProductResponse): string[] {
  const nutritionRows = (p.details?.nutrition?.rows ?? [])
    .map((r) => [r.nutrient, r.value, r.unit].filter(Boolean).join(':'))
    .join(' | ');

  return [
    cell(p.id),
    cell(p.sku),
    cell(p.barcode),
    cell(p.name),
    cell(p.brand),
    cell(p.categoryId),
    cell(p.categoryName),
    cell(p.basePrice),
    cell(p.content?.amount),
    cell(p.content?.uom),
    cell(p.content?.multipackCount),
    cell(p.description),
    cell(p.shortDescription),
    cell(p.slug),
    cell(p.images),
    cell(p.tags),
    cell(p.weightGrams),
    cell(p.groupId),
    cell(p.isActive),
    cell(p.searchKeywords),
    cell(p.searchPriority),
    cell(p.isBestseller),
    cell(p.orderCount),
    cell(p.availableQuantity),
    cell(p.badges?.map((b) => b.code) ?? []),
    cell(p.badges?.map((b) => b.label) ?? []),
    cell(p.details?.version),
    cell(p.details?.about),
    cell(p.details?.storage?.instructions),
    cell(p.details?.storage?.shelfLife),
    cell(p.details?.storage?.useByDate),
    cell(p.details?.storage?.temperatureBand),
    cell(p.details?.nutrition?.servingSize),
    cell(nutritionRows),
    cell(p.createdAt),
    cell(p.updatedAt)
  ];
}

export function productsToCsv(products: ProductResponse[]): string {
  const lines = [HEADERS.join(',')];
  for (const p of products) {
    lines.push(productToRow(p).join(','));
  }
  return lines.join('\n');
}

export function downloadProductsCsv(products: ProductResponse[], filename = 'products.csv') {
  const csv = productsToCsv(products);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
