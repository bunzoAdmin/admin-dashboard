export interface ShelfLocationSummary {
  locationCode: string;
  skuCount: number;
  totalUnits: number;
}

export interface ShelfLocationsResponse {
  storeId: number;
  locations: ShelfLocationSummary[];
}

export interface LocationStockItem {
  inventoryItemId: number;
  sku: string;
  productName: string;
  barcode?: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  lastUpdated?: string | null;
}

export interface LocationStockResponse {
  storeId: number;
  locationCode: string;
  items: LocationStockItem[];
  totalSkus: number;
  totalUnits: number;
}

export interface InventoryItemResponse {
  id: number;
  sku: string;
  productId: number;
  storeId: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  safetyStock: number;
  maxStock?: number | null;
  unitCost?: number | null;
  lastUpdated?: string | null;
  lowStock: boolean;
  needsReplenishment: boolean;
  locationCode?: string | null;
}

export type StoreStockAvailabilityStatus = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';

/** One physical bin under a store/SKU browse row. */
export interface StoreStockBrowseBin {
  inventoryItemId: number;
  locationCode?: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  safetyStock?: number | null;
  maxStock?: number | null;
  availabilityStatus: StoreStockAvailabilityStatus;
  lowStock: boolean;
  lastUpdated?: string | null;
}

/** One catalog product at a store — stock aggregated across bins. */
export interface StoreStockBrowseItem {
  productId: number;
  sku: string;
  productName: string;
  barcode?: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  safetyStock?: number | null;
  maxStock?: number | null;
  availabilityStatus: StoreStockAvailabilityStatus;
  lowStock: boolean;
  binCount: number;
  lastUpdated?: string | null;
  bins: StoreStockBrowseBin[];
}

export interface StoreStockBrowsePageResponse {
  storeId: number;
  content: StoreStockBrowseItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const STORE_STOCK_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'AVAILABLE', label: 'In stock' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' }
] as const;

export interface DiscrepancyDetailResponse {
  id: number;
  storeId: number;
  sku: string;
  orderUuid?: string | null;
  pickTaskId?: number | null;
  expectedQty: number;
  foundQty: number;
  discrepancyQty: number;
  reason?: string | null;
  locationCode?: string | null;
  autoZeroed?: boolean | null;
  status: 'OPEN' | 'RESOLVED' | string;
  reportCount?: number | null;
  /** Picker id as string when reported from the pick flow. */
  reportedBy?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface StockMovementResponse {
  id: number;
  inventoryItemId: number;
  sku?: string | null;
  storeId?: number | null;
  movementType: string;
  movementTypeDescription?: string | null;
  quantity: number;
  referenceType: string;
  referenceTypeDescription?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface StockMovementsPageResponse {
  content: StockMovementResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const MOVEMENT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'RESERVE', label: 'Reserve' },
  { value: 'UNRESERVE', label: 'Unreserve' },
  { value: 'ADJUSTMENT', label: 'Adjustment' }
];
