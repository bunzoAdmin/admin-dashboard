export interface CartGift {
  id: number;
  name: string;
  enabled: boolean;
  storeId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  priority: number;
  minSubtotal: number;
  sku: string;
  freeQty: number;
  badgeText?: string | null;
  displayHeadline?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateCartGiftRequest {
  name: string;
  enabled?: boolean;
  storeId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  priority?: number;
  minSubtotal: number;
  sku: string;
  freeQty: number;
  badgeText?: string;
  displayHeadline?: string;
}

export interface PatchCartGiftRequest {
  enabled?: boolean;
  name?: string;
  storeId?: number | null;
  clearStoreId?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  clearStartsAt?: boolean;
  clearEndsAt?: boolean;
  priority?: number;
  minSubtotal?: number;
  sku?: string;
  freeQty?: number;
  badgeText?: string;
  displayHeadline?: string;
}
