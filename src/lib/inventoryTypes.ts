export interface AddStockRequest {
  sku: string;
  storeId: number;
  quantity: number;
  reason?: string;
  referenceId?: string;
  storeroom?: boolean;
  locationCode?: string;
}

export interface TransferStockRequest {
  sku: string;
  storeId: number;
  quantity: number;
  reason?: string;
  referenceId?: string;
  fromStoreroom?: boolean;
  fromLocationCode?: string;
  toStoreroom?: boolean;
  toLocationCode?: string;
}

export interface AddStockResponse {
  sku: string;
  storeId: number;
  quantityAdded: number;
  previousCurrentStock: number;
  newCurrentStock: number;
  movementId: number;
  locationCode: string;
  idempotent: boolean;
}

export interface TransferStockResponse {
  sku: string;
  storeId: number;
  quantityTransferred: number;
  fromLocationCode: string;
  toLocationCode: string;
  previousFromStock: number;
  newFromStock: number;
  previousToStock: number;
  newToStock: number;
  outboundMovementId: number;
  inboundMovementId: number;
  transferReferenceId: string;
  idempotent: boolean;
}

export interface AdjustStockRequest {
  sku: string;
  storeId: number;
  quantityDelta?: number;
  targetCurrentStock?: number;
  expectedCurrentStock?: number;
  reason: string;
  referenceId?: string;
  storeroom?: boolean;
  locationCode?: string;
}

export interface AdjustStockResponse {
  sku: string;
  storeId: number;
  quantityAdjusted: number;
  previousCurrentStock: number;
  newCurrentStock: number;
  movementId?: number | null;
  locationCode: string;
  idempotent: boolean;
  noChange?: boolean;
}

export interface InventoryBinResponse {
  id: number;
  sku: string;
  storeId: number;
  locationCode: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  maxStock?: number | null;
}

export interface ProductAvailability {
  sku: string;
  productId?: number;
  currentStock?: number;
  availableStock?: number;
  reservedStock?: number;
  safetyStock?: number;
  inStock?: boolean;
  lowStock?: boolean;
  availabilityStatus?: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  locationCode?: string;
}

export interface InventoryAvailabilityResponse {
  storeId: number;
  products: ProductAvailability[];
}
