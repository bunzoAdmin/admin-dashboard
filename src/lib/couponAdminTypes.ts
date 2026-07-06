export type DiscountType = 'FIXED_AMOUNT' | 'PERCENTAGE';
export type ApplyOn = 'SUBTOTAL' | 'RUNNING_TOTAL';

export interface CouponDefinition {
  code: string;
  enabled: boolean;
  displayHeadline?: string | null;
  displayCondition?: string | null;
  discountType: DiscountType;
  discountValue: number;
  ruleType: 'ALWAYS' | 'MIN_ORDER_VALUE' | 'COMPLETED_ORDER_COUNT' | 'PAYMENT_METHOD';
  ruleConfig?: string | null;
  stackGroup?: string | null;
  stackPriority: number;
  stackLayer: number;
  standalone: boolean;
  applyOn: ApplyOn;
  updatedAt?: string | null;
}

export interface CreateCouponRequest {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  ruleType: CouponDefinition['ruleType'];
  ruleConfig?: string;
  enabled?: boolean;
  displayHeadline?: string;
  displayCondition?: string;
  stackGroup?: string;
  stackPriority?: number;
  stackLayer?: number;
  standalone?: boolean;
  applyOn?: ApplyOn;
}

export interface PatchCouponRequest {
  enabled?: boolean;
  discountValue?: number;
  ruleConfig?: string;
  displayHeadline?: string;
  displayCondition?: string;
}

export const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; label: string }[] = [
  { value: 'FIXED_AMOUNT', label: 'Fixed amount (ZMW)' },
  { value: 'PERCENTAGE', label: 'Percentage (%)' }
];

export const APPLY_ON_OPTIONS: { value: ApplyOn; label: string }[] = [
  { value: 'SUBTOTAL', label: 'Subtotal' },
  { value: 'RUNNING_TOTAL', label: 'Running total (after prior discounts)' }
];
