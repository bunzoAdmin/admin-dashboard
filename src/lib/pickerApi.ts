'use client';

import { getStoredToken } from './store';
import type {
  AdminCancelTaskRequest,
  AssignPickerRequest,
  AttentionSummaryResponse,
  CreateDeliveryZoneRequest,
  CreateShiftRequest,
  DeliveryZoneResponse,
  PickerPinResetResponse,
  PickerResponse,
  PickerStatusResponse,
  PickerAnalyticsPeriod,
  PickerAnalyticsResponse,
  PickerStoreMetricsResponse,
  ReassignTaskRequest,
  ReconciliationOutboxResponse,
  RegisterPickerRequest,
  ShiftCoverageListResponse,
  ShiftResponse,
  ShortPickDetailResponse,
  ShortPickPageResponse,
  ShortPickType,
  TaskDetailResponse,
  TaskHistoryPageResponse,
  TaskListResponse,
  UpdateDeliveryZoneRequest,
  UpdatePickerRequest,
  UpdateShiftRequest
} from './pickerTypes';
import { inventoryApiConfigured, inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';

export class PickerApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PickerApiError';
    this.status = status;
  }
}

function configured(): boolean {
  return inventoryApiConfigured();
}

async function pickerRequest<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!configured()) {
    throw new PickerApiError(0, 'Picker API is not available.');
  }

  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(inventoryApiUrl(path), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new PickerApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new PickerApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Picker request failed.')
    );
  }

  return data as T;
}

export const pickerApi = {
  listPickers: (
    storeId: number,
    opts?: { status?: string; q?: string; page?: number; size?: number; includeOffboarded?: boolean }
  ) => {
    const q = new URLSearchParams({ storeId: String(storeId), page: String(opts?.page ?? 0), size: String(opts?.size ?? 50) });
    if (opts?.status) q.set('status', opts.status);
    if (opts?.q?.trim()) q.set('q', opts.q.trim());
    if (opts?.includeOffboarded) q.set('includeOffboarded', 'true');
    return pickerRequest<PickerResponse[]>(`/admin/picker/pickers?${q}`);
  },

  getPicker: (pickerId: number) => pickerRequest<PickerResponse>(`/admin/picker/pickers/${pickerId}`),

  registerPicker: (body: RegisterPickerRequest) =>
    pickerRequest<PickerResponse>('/admin/picker/pickers', { method: 'POST', body }),

  updatePicker: (pickerId: number, body: UpdatePickerRequest) =>
    pickerRequest<PickerResponse>(`/admin/picker/pickers/${pickerId}`, { method: 'PUT', body }),

  offboardPicker: (pickerId: number) =>
    pickerRequest<PickerResponse>(`/admin/picker/pickers/${pickerId}/offboard`, { method: 'POST' }),

  reactivatePicker: (pickerId: number) =>
    pickerRequest<PickerResponse>(`/admin/picker/pickers/${pickerId}/reactivate`, { method: 'POST' }),

  resetPin: (pickerId: number) =>
    pickerRequest<PickerPinResetResponse>(`/admin/picker/pickers/${pickerId}/reset-pin`, { method: 'POST' }),

  revokeSessions: (pickerId: number) =>
    pickerRequest<void>(`/admin/picker/pickers/${pickerId}/revoke-sessions`, { method: 'POST' }),

  forceCheckOut: (pickerId: number) =>
    pickerRequest<PickerStatusResponse>(`/admin/picker/pickers/${pickerId}/force-check-out`, { method: 'POST' }),

  listTasks: (storeId: number, opts?: { status?: string; page?: number; size?: number }) => {
    const q = new URLSearchParams({ storeId: String(storeId), page: String(opts?.page ?? 0), size: String(opts?.size ?? 50) });
    if (opts?.status) q.set('status', opts.status);
    return pickerRequest<TaskListResponse[]>(`/admin/picker/tasks?${q}`);
  },

  getTask: (taskId: number) => pickerRequest<TaskListResponse>(`/admin/picker/tasks/${taskId}`),

  getTaskDetail: (taskId: number) => pickerRequest<TaskDetailResponse>(`/admin/picker/tasks/${taskId}/detail`),

  getTaskForOrder: (orderNumber: string) =>
    pickerRequest<TaskListResponse | null>(`/admin/picker/tasks/by-order/${encodeURIComponent(orderNumber)}`),

  assignPicker: (orderNumber: string, body: AssignPickerRequest) =>
    pickerRequest<TaskListResponse>(
      `/admin/picker/orders/${encodeURIComponent(orderNumber)}/assign-picker`,
      { method: 'POST', body }
    ),

  reassignTask: (taskId: number, body: ReassignTaskRequest) =>
    pickerRequest<TaskListResponse>(`/admin/picker/tasks/${taskId}/reassign`, { method: 'POST', body }),

  cancelTask: (taskId: number, body: AdminCancelTaskRequest) =>
    pickerRequest<void>(`/admin/picker/tasks/${taskId}/cancel`, { method: 'POST', body }),

  listAttention: (storeId: number, inProgressStaleMinutes = 5) =>
    pickerRequest<AttentionSummaryResponse>(
      `/admin/picker/attention?storeId=${storeId}&inProgressStaleMinutes=${inProgressStaleMinutes}`
    ),

  listShortPicks: (
    storeId: number,
    opts: {
      type?: ShortPickType | '';
      from?: string;
      toExclusive?: string;
      page?: number;
      size?: number;
    } = {}
  ) => {
    const q = new URLSearchParams({ storeId: String(storeId) });
    if (opts.type) q.set('type', opts.type);
    if (opts.from) q.set('from', opts.from);
    if (opts.toExclusive) q.set('toExclusive', opts.toExclusive);
    q.set('page', String(opts.page ?? 0));
    q.set('size', String(opts.size ?? 20));
    return pickerRequest<ShortPickPageResponse>(`/admin/picker/short-picks?${q}`);
  },

  getShortPickDetail: (taskId: number) =>
    pickerRequest<ShortPickDetailResponse>(`/admin/picker/short-picks/${taskId}`),

  getMetrics: (storeId: number) =>
    pickerRequest<PickerStoreMetricsResponse>(`/admin/picker/metrics?storeId=${storeId}`),

  getAnalytics: (
    storeId: number,
    opts: {
      period: PickerAnalyticsPeriod;
      from: string;
      toExclusive: string;
      label?: string;
      calendarFrom?: string;
      calendarTo?: string;
      utcOffsetMinutes?: number;
    }
  ) => {
    const q = new URLSearchParams({
      storeId: String(storeId),
      period: opts.period,
      from: opts.from,
      toExclusive: opts.toExclusive
    });
    if (opts.label) q.set('label', opts.label);
    if (opts.calendarFrom) q.set('calendarFrom', opts.calendarFrom);
    if (opts.calendarTo) q.set('calendarTo', opts.calendarTo);
    if (opts.utcOffsetMinutes != null) q.set('utcOffsetMinutes', String(opts.utcOffsetMinutes));
    return pickerRequest<PickerAnalyticsResponse>(`/admin/picker/metrics/analytics?${q}`);
  },

  getShiftCoverage: (storeId: number) =>
    pickerRequest<ShiftCoverageListResponse>(`/admin/picker/shifts/coverage?storeId=${storeId}`),

  listShifts: (storeId: number) => pickerRequest<ShiftResponse[]>(`/admin/picker/shifts?storeId=${storeId}`),

  createShift: (body: CreateShiftRequest) =>
    pickerRequest<ShiftResponse>('/admin/picker/shifts', { method: 'POST', body }),

  updateShift: (shiftId: number, body: UpdateShiftRequest) =>
    pickerRequest<ShiftResponse>(`/admin/picker/shifts/${shiftId}`, { method: 'PUT', body }),

  deleteShift: (shiftId: number) =>
    pickerRequest<void>(`/admin/picker/shifts/${shiftId}`, { method: 'DELETE' }),

  listDeliveryZones: (storeId: number) =>
    pickerRequest<DeliveryZoneResponse[]>(`/admin/picker/delivery-zones?storeId=${storeId}`),

  createDeliveryZone: (body: CreateDeliveryZoneRequest) =>
    pickerRequest<DeliveryZoneResponse>('/admin/picker/delivery-zones', { method: 'POST', body }),

  updateDeliveryZone: (zoneId: number, body: UpdateDeliveryZoneRequest) =>
    pickerRequest<DeliveryZoneResponse>(`/admin/picker/delivery-zones/${zoneId}`, { method: 'PUT', body }),

  /** Soft-deactivates a zone (keeps history). */
  deleteDeliveryZone: (zoneId: number) =>
    pickerRequest<DeliveryZoneResponse>(`/admin/picker/delivery-zones/${zoneId}`, { method: 'DELETE' }),

  listReconcileFailures: (page = 0, size = 50, storeId?: number) => {
    const q = new URLSearchParams({ page: String(page), size: String(size) });
    if (storeId != null) q.set('storeId', String(storeId));
    return pickerRequest<ReconciliationOutboxResponse[]>(`/admin/picker/reconcile/failures?${q}`);
  },

  replayReconcile: (outboxId: number) =>
    pickerRequest<ReconciliationOutboxResponse>(`/admin/picker/reconcile/${outboxId}/replay`, { method: 'POST' }),

  getPickerTasks: (
    pickerId: number,
    opts?: { page?: number; size?: number; period?: string; sort?: string }
  ) => {
    const q = new URLSearchParams({
      page: String(opts?.page ?? 0),
      size: String(opts?.size ?? 20),
      period: opts?.period ?? 'WEEK',
      sort: opts?.sort ?? 'COMPLETED_DESC'
    });
    return pickerRequest<TaskHistoryPageResponse>(`/admin/picker/pickers/${pickerId}/tasks?${q}`);
  }
};
