export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PACKING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'COD_PENDING'
  | 'COD_COLLECTED'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REFUND_FAILED';

export interface OrderItemResponse {
  sku: string;
  productName: string;
  imageUrl?: string | null;
  orderedQuantity: number;
  fulfilledQuantity?: number | null;
  unitPrice: number;
  subTotal: number;
}

export interface DeliveryInfo {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  recipientName?: string | null;
  notes?: string | null;
}

export interface RefundSummary {
  paidAmount?: number | null;
  amountRefunded?: number | null;
  netPaid?: number | null;
  feesRetained?: number | null;
  refundStatus?: string | null;
}

export interface DiscountBreakdownItem {
  couponCode?: string | null;
  description?: string | null;
  amount?: number | null;
}

export interface OrderResponse {
  orderNumber: string;
  customerId: string;
  storeId: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentPhone?: string | null;
  message?: string | null;
  itemsTotal: number;
  subtotalBeforeDiscount?: number | null;
  discountAmount?: number | null;
  deliveryFee: number;
  nightConvenienceFee?: number | null;
  weekendConvenienceFee?: number | null;
  handlingFee?: number | null;
  grandTotal: number;
  currency: string;
  appliedCouponCodes: string[];
  discountBreakdown: DiscountBreakdownItem[];
  delivery?: DeliveryInfo | null;
  items: OrderItemResponse[];
  deliveryZone?: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledReason?: string | null;
  cancelledReasonDisplay?: string | null;
  cancelType?: string | null;
  cancelledAt?: string | null;
  refundSummary?: RefundSummary | null;
}

export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PagedOrderResponse {
  content: OrderResponse[];
  meta: PageMeta;
}

export interface OrderEventResponse {
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorId?: string | null;
  notes?: string | null;
  occurredAt: string;
}

export interface CancelOrderRequest {
  reason: string;
  cancelType?: 'STANDARD' | 'REFUSAL_AT_DOOR';
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string;
}

export const ORDER_STATUS_OPTIONS: { value: OrderStatus | ''; label: string; color: string }[] = [
  { value: '', label: 'All statuses', color: 'gray' },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment', color: 'amber' },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'blue' },
  { value: 'PACKING', label: 'Packing', color: 'blue' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready for Delivery', color: 'blue' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'blue' },
  { value: 'DELIVERED', label: 'Delivered', color: 'green' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'red' }
];

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus | ''; label: string }[] = [
  { value: '', label: 'All payment statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'COD_PENDING', label: 'COD Pending' },
  { value: 'COD_COLLECTED', label: 'COD Collected' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially Refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'REFUND_FAILED', label: 'Refund Failed' }
];
