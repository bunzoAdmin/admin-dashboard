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

export interface DiscrepancyDetailResponse {
  id: number;
  storeId: number;
  sku: string;
  reportedBy?: string | null;
  expectedQuantity: number;
  actualQuantity: number;
  discrepancyQuantity: number;
  status: 'OPEN' | 'RESOLVED';
  notes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
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
