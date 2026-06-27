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
