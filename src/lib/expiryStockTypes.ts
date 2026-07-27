export type ExpiryBucket = 'ALL' | 'ATTENTION' | 'EXPIRED' | 'EXPIRING' | 'NO_EXPIRY' | 'OK';

export interface ExpiryStockRow {
  inventoryItemId: number;
  productId: number;
  sku: string;
  productName: string;
  barcode?: string | null;
  locationCode?: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unitCost?: number | null;
  useByDate?: string | null;
  daysUntilExpiry?: number | null;
  bucket: 'EXPIRED' | 'EXPIRING' | 'OK' | 'NO_EXPIRY';
}

export interface ExpiryStockReportResponse {
  storeId: number;
  withinDays: number;
  asOfDate: string;
  summary: {
    expiredCount: number;
    expiringCount: number;
    noExpiryCount: number;
    totalRows: number;
    expiredUnits: number;
    expiringUnits: number;
    noExpiryUnits: number;
  };
  items: ExpiryStockRow[];
  page: number;
  size: number;
  totalFiltered: number;
  totalPages: number;
}
