export type DiscountType = 'FIXED_AMOUNT' | 'PERCENTAGE';
export type PromotionAudience = 'ALL' | 'FIRST_N_ORDERS';
export type CouponInteraction = 'STACK_FULL_CART' | 'STACK_EXCLUDE_PROMO_LINES' | 'BLOCK_COUPONS';

export interface PromotionItem {
  id?: number;
  promotionId?: number;
  sku: string;
  discountType: DiscountType;
  discountValue: number;
  maxQty: number;
}

export interface Promotion {
  id: number;
  name: string;
  enabled: boolean;
  storeId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  audience: PromotionAudience;
  maxCompletedOrders?: number | null;
  couponInteraction: CouponInteraction;
  priority: number;
  badgeText?: string | null;
  displayHeadline?: string | null;
  items?: PromotionItem[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreatePromotionRequest {
  name: string;
  enabled?: boolean;
  storeId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  audience: PromotionAudience;
  maxCompletedOrders?: number | null;
  couponInteraction: CouponInteraction;
  priority?: number;
  badgeText?: string;
  displayHeadline?: string;
  items: Array<{
    sku: string;
    discountType: DiscountType;
    discountValue: number;
    maxQty: number;
  }>;
}

export interface PatchPromotionRequest {
  enabled?: boolean;
  name?: string;
  storeId?: number | null;
  clearStoreId?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  clearStartsAt?: boolean;
  clearEndsAt?: boolean;
  audience?: PromotionAudience;
  maxCompletedOrders?: number | null;
  couponInteraction?: CouponInteraction;
  priority?: number;
  badgeText?: string;
  displayHeadline?: string;
  items?: CreatePromotionRequest['items'];
}

export const AUDIENCE_OPTIONS: { value: PromotionAudience; label: string }[] = [
  { value: 'FIRST_N_ORDERS', label: 'First N orders (by customer at this store)' },
  { value: 'ALL', label: 'Everyone' }
];

export const INTERACTION_OPTIONS: { value: CouponInteraction; label: string }[] = [
  { value: 'STACK_FULL_CART', label: 'Coupons apply to full remaining cart (including promo SKU)' },
  { value: 'STACK_EXCLUDE_PROMO_LINES', label: 'Coupons skip promo SKUs' },
  { value: 'BLOCK_COUPONS', label: 'Hide / block coupons while this promo is in the cart' }
];
