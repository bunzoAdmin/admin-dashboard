export type PickerStatus = 'OFFLINE' | 'AVAILABLE' | 'PICKING' | 'ON_BREAK';
export type PickTaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'PICKED' | 'CANCELLED';

export interface PickerResponse {
  id: number;
  storeId: number;
  name: string;
  phone: string;
  status: PickerStatus;
  shiftId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  initialPin?: string;
  offboardedAt?: string | null;
}

export interface RegisterPickerRequest {
  name: string;
  phone: string;
  storeId: number;
  shiftId: number;
  fcmToken?: string;
}

export interface PickerPinResetResponse {
  pickerId: number;
  initialPin: string;
}

export interface PickerStatusResponse {
  pickerId: number;
  storeId: number;
  name: string;
  status: string;
}

export interface TaskListResponse {
  id: number;
  orderUuid: string;
  orderNumber?: string | null;
  storeId: number;
  pickerId?: number | null;
  pickerName?: string | null;
  status: PickTaskStatus;
  cancelledReason?: string | null;
  createdAt?: string;
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  elapsedSeconds?: number | null;
  processedItemCount?: number | null;
  pendingItemCount?: number | null;
}

export interface ReassignTaskRequest {
  newPickerId: number;
}

export interface AssignPickerRequest {
  pickerId: number;
}

export interface AdminCancelTaskRequest {
  reason: string;
}

export interface ShiftResponse {
  id: number;
  storeId: number;
  code: string;
  displayName: string;
  startTime: string;
  endTime: string;
  timezone: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShiftRequest {
  storeId: number;
  code: string;
  displayName: string;
  startTime: string;
  endTime: string;
  timezone?: string;
}

export interface UpdateShiftRequest {
  code: string;
  displayName: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface UpdatePickerRequest {
  name?: string;
  storeId?: number;
  shiftId?: number;
}

export interface ReconciliationOutboxResponse {
  id: number;
  type: string;
  status: string;
  attemptCount: number;
  lastError?: string | null;
  nextRetryAt?: string | null;
  createdAt?: string | null;
  storeId?: number | null;
  orderUuid?: string | null;
  orderNumber?: string | null;
  sku?: string | null;
  pickTaskId?: number | null;
}

export type AttentionKind = 'PENDING_TASK' | 'ORPHAN_ORDER' | 'ACCEPTANCE_TIMEOUT' | 'IN_PROGRESS_STALE';

export interface AttentionItemResponse {
  kind: AttentionKind | string;
  taskId?: number | null;
  orderUuid?: string | null;
  orderNumber?: string | null;
  storeId?: number | null;
  pickerId?: number | null;
  pickerName?: string | null;
  taskStatus?: string | null;
  since?: string | null;
  elapsedSeconds?: number | null;
  detail?: string | null;
}

export interface AttentionSummaryResponse {
  items: AttentionItemResponse[];
  total: number;
}

export interface PickTaskItemResponse {
  id: number;
  sku: string;
  productName: string;
  imageUrl?: string | null;
  barcode?: string | null;
  locationCode?: string | null;
  quantity: number;
  pickedQuantity: number;
  unitPrice: number;
  status: string;
  verified: boolean;
}

export interface TaskDetailResponse extends TaskListResponse {
  pickerName?: string | null;
  paymentMethod?: string | null;
  deliveryZoneLabel?: string | null;
  acceptanceDeadline?: string | null;
  items: PickTaskItemResponse[];
}

export interface PickerPerformanceRow {
  pickerId: number;
  name: string;
  completedToday: number;
  avgPickSeconds?: number | null;
}

export interface PickerStoreMetricsResponse {
  storeId: number;
  availablePickers: number;
  pickingPickers: number;
  onBreakPickers: number;
  offlinePickers: number;
  pendingTasks: number;
  activeTasks: number;
  completedToday: number;
  avgPickSecondsToday?: number | null;
  attentionCount: number;
  topPickers: PickerPerformanceRow[];
}

export type PickerAnalyticsPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export interface PickerAnalyticsResponse {
  storeId: number;
  period: PickerAnalyticsPeriod;
  fromDate: string;
  toDate: string;
  periodLabel: string;
  rangeStart?: string;
  rangeEnd?: string;
  overview: {
    completedTasks: number;
    avgPickSeconds?: number | null;
    fastestPickSeconds?: number | null;
    slowestPickSeconds?: number | null;
    activePickers: number;
    pendingTasks: number;
    activeTasks: number;
    avgAssignToStartSeconds?: number | null;
    avgStartToCompleteSeconds?: number | null;
    acceptanceTimeoutCount?: number;
    orphanOrderCount?: number;
  };
  roster: {
    available: number;
    picking: number;
    onBreak: number;
    offline: number;
  };
  dailyTrend: Array<{
    date: string;
    completedTasks: number;
    avgPickSeconds?: number | null;
  }>;
  pickers: Array<{
    pickerId: number;
    name: string;
    completedTasks: number;
    avgPickSeconds?: number | null;
    fastestPickSeconds?: number | null;
    slowestPickSeconds?: number | null;
  }>;
}

export interface ShiftCoverageRow {
  shiftId: number;
  shiftCode: string;
  shiftDisplayName: string;
  available: number;
  picking: number;
  onBreak: number;
  offline: number;
  totalActive: number;
}

export interface ShiftCoverageListResponse {
  shifts: ShiftCoverageRow[];
  storeActiveTasks: number;
  storePendingTasks: number;
}

export interface DeliveryZoneResponse {
  id: number;
  storeId: number;
  color: string;
  rackNumber: number;
  displayLabel: string;
  sortOrder: number;
  active: boolean;
  createdAt?: string | null;
}

export interface CreateDeliveryZoneRequest {
  storeId: number;
  color: string;
  rackNumber: number;
  displayLabel?: string;
  sortOrder: number;
  active?: boolean;
}

export interface UpdateDeliveryZoneRequest {
  color: string;
  rackNumber: number;
  displayLabel: string;
  sortOrder: number;
  active: boolean;
}

export interface StoreResponse {
  id: number;
  storeCode?: string | null;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceableRadiusKm?: number | null;
  isActive?: boolean | null;
}

export interface TaskHistoryEntry {
  pickTaskId: number;
  orderUuid: string;
  orderNumber?: string | null;
  status: string;
  paymentMethod?: string | null;
  completedAt?: string | null;
  startedAt?: string | null;
  durationSeconds?: number | null;
  itemCount: number;
  pickedCount: number;
  unavailableCount: number;
}

export interface TaskHistoryPageResponse {
  items: TaskHistoryEntry[];
  total: number;
  page: number;
  size: number;
  hasMore: boolean;
  period?: string;
  sort?: string;
}

export const PICKER_STATUS_OPTIONS: { value: PickerStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'PICKING', label: 'Picking' },
  { value: 'ON_BREAK', label: 'On break' },
  { value: 'OFFLINE', label: 'Offline' }
];

export const TASK_STATUS_OPTIONS: { value: PickTaskStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PICKED', label: 'Picked' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export const ACTIVE_TASK_STATUSES: PickTaskStatus[] = ['ASSIGNED', 'IN_PROGRESS'];

export type ShortPickType =
  | 'PARTIAL_SHORT'
  | 'ITEM_UNAVAILABLE'
  | 'ALL_UNAVAILABLE_CANCEL'
  | 'PREPAID_BLOCKED_CANCEL';

export interface ShortPickListEntryResponse {
  taskId: number;
  orderUuid: string;
  orderNumber?: string | null;
  storeId: number;
  pickerId?: number | null;
  pickerName?: string | null;
  taskStatus: string;
  orderStatus?: string | null;
  paymentMethod?: string | null;
  cancelledReason?: string | null;
  primaryOutcome: string;
  outcomes: string[];
  shortedItemCount: number;
  unavailableItemCount: number;
  partialShortItemCount: number;
  totalItemCount: number;
  orderGrandTotal?: number | null;
  paidAmount?: number | null;
  refundedAmount?: number | null;
  occurredAt?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
}

export interface ShortPickPageResponse {
  items: ShortPickListEntryResponse[];
  total: number;
  page: number;
  size: number;
}

export interface ShortPickLineResponse {
  pickItemId: number;
  sku: string;
  productName: string;
  imageUrl?: string | null;
  barcode?: string | null;
  locationCode?: string | null;
  orderedQuantity: number;
  pickedQuantity: number;
  fulfilledQuantity?: number | null;
  unitPrice?: number | null;
  lineSubTotal?: number | null;
  pickItemStatus: string;
  lineOutcome: string;
  stockOutcome?: string | null;
  pickedAt?: string | null;
}

export interface ShortPickRefundResponse {
  refundId: string;
  amount: number;
  currency?: string | null;
  reason?: string | null;
  status?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
}

export interface ShortPickEventResponse {
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorId?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface ShortPickDiscrepancyResponse {
  id: number;
  sku: string;
  locationCode?: string | null;
  expectedQty: number;
  foundQty: number;
  discrepancyQty: number;
  reason: string;
  autoZeroed?: boolean | null;
  status?: string | null;
  reportCount?: number | null;
  reportedBy?: string | null;
  createdAt?: string | null;
}

export interface ShortPickStockReturnResponse {
  id: number;
  sku?: string | null;
  locationCode?: string | null;
  quantity: number;
  reason?: string | null;
  createdAt?: string | null;
}

export interface ShortPickDetailResponse {
  taskId: number;
  orderUuid: string;
  orderNumber?: string | null;
  storeId: number;
  pickerId?: number | null;
  pickerName?: string | null;
  taskStatus: string;
  orderStatus?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  cancelledReason?: string | null;
  cancelType?: string | null;
  primaryOutcome: string;
  outcomes: string[];
  subtotalBeforeDiscount?: number | null;
  discountAmount?: number | null;
  totalAmount?: number | null;
  deliveryFee?: number | null;
  handlingFee?: number | null;
  paidAmount?: number | null;
  orderGrandTotal?: number | null;
  currency?: string | null;
  taskCreatedAt?: string | null;
  taskAssignedAt?: string | null;
  taskStartedAt?: string | null;
  taskCompletedAt?: string | null;
  orderCreatedAt?: string | null;
  items: ShortPickLineResponse[];
  refunds: ShortPickRefundResponse[];
  events: ShortPickEventResponse[];
  discrepancies: ShortPickDiscrepancyResponse[];
  cancellationReturns: ShortPickStockReturnResponse[];
  stockOutcomeNotes: string[];
}

export const SHORT_PICK_TYPE_OPTIONS: { value: ShortPickType | ''; label: string }[] = [
  { value: '', label: 'All outcomes' },
  { value: 'PARTIAL_SHORT', label: 'Partial short pick' },
  { value: 'ITEM_UNAVAILABLE', label: 'Item unavailable' },
  { value: 'ALL_UNAVAILABLE_CANCEL', label: 'All unavailable (cancelled)' },
  { value: 'PREPAID_BLOCKED_CANCEL', label: 'Prepaid blocked cancel' }
];
