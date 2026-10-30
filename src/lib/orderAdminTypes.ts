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
  invoice?: InvoiceInfo | null;
}

export interface InvoiceInfo {
  available: boolean;
  status?: string | null;
  invoiceNumber?: number | null;
  receiptNumber?: string | null;
  issuedAt?: string | null;
  pdfUrl?: string | null;
  s3Url?: string | null;
  qrCodeUrl?: string | null;
  lastError?: string | null;
}

/**
 * Admin ops list row — the base `OrderResponse` fields plus pick task / picker / age fields
 * that only the admin order list renders. Kept separate from `OrderResponse` (returned to the
 * customer app, rider service, and the admin single-order detail endpoint) so those callers
 * never see fields they don't use. The backend flattens this into the same top-level JSON
 * shape as `OrderResponse` (see `AdminOrderResponse` @JsonUnwrapped on the order-service side).
 */
export interface AdminOrderListItem extends OrderResponse {
  ageMinutes?: number | null;
  pickTaskId?: number | null;
  pickTaskStatus?: string | null;
  pickerId?: number | null;
  pickerName?: string | null;
}

export interface OrderPipelineStage {
  status: string;
  count: number;
  oldestCreatedAt?: string | null;
  oldestAgeMinutes?: number | null;
}

export interface OrderPipelineResponse {
  storeId: number;
  stages: OrderPipelineStage[];
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

export interface PagedAdminOrderResponse {
  content: AdminOrderListItem[];
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

export const INVOICE_BACKLOG_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All missing / failed' },
  { value: 'MISSING', label: 'No invoice row' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SKIPPED', label: 'Skipped' }
];

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

/** Admin cancel is allowed for these statuses (backend also blocks DELIVERED). */
export const CANCELLABLE_ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PACKING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY'
];

/** Manual status advances only (cancel uses the dedicated cancel endpoint). */
export const ORDER_NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: ['CONFIRMED'],
  CONFIRMED: ['PACKING'],
  PACKING: ['READY_FOR_DELIVERY'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED']
};

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
