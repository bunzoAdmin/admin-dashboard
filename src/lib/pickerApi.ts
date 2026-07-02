'use client';

import { getStoredToken } from './store';
import type {
  AdminCancelTaskRequest,
  CreateShiftRequest,
  PickerPinResetResponse,
  PickerResponse,
  PickerStatusResponse,
  ReassignTaskRequest,
  ReconciliationOutboxResponse,
  RegisterPickerRequest,
  ShiftResponse,
  TaskListResponse,
  UpdateShiftRequest
} from './pickerTypes';
import { INVENTORY_API_BASE_URL, inventoryApiConfigured } from './inventoryApiConfig';

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

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function pickerRequest<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!configured()) {
    throw new PickerApiError(0, 'Order API URL is not configured. Set NEXT_PUBLIC_INVENTORY_API_BASE_URL.');
  }

  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${INVENTORY_API_BASE_URL}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new PickerApiError(0, 'Could not reach the order service.');
  }

  const data = await parseBody(res);
  if (!res.ok) {
    const msg =
      (data as { message?: string } | null)?.message ??
      (typeof data === 'string' ? data : `Request failed (${res.status}).`);
    throw new PickerApiError(res.status, msg);
  }

  return data as T;
}

export const pickerApi = {
  listPickers: (storeId: number, opts?: { status?: string; page?: number; size?: number }) => {
    const q = new URLSearchParams({ storeId: String(storeId), page: String(opts?.page ?? 0), size: String(opts?.size ?? 50) });
    if (opts?.status) q.set('status', opts.status);
    return pickerRequest<PickerResponse[]>(`/admin/picker/pickers?${q}`);
  },

  registerPicker: (body: RegisterPickerRequest) =>
    pickerRequest<PickerResponse>('/admin/picker/pickers', { method: 'POST', body }),

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

  reassignTask: (taskId: number, body: ReassignTaskRequest) =>
    pickerRequest<TaskListResponse>(`/admin/picker/tasks/${taskId}/reassign`, { method: 'POST', body }),

  cancelTask: (taskId: number, body: AdminCancelTaskRequest) =>
    pickerRequest<void>(`/admin/picker/tasks/${taskId}/cancel`, { method: 'POST', body }),

  listShifts: (storeId: number) =>
    pickerRequest<ShiftResponse[]>(`/admin/picker/shifts?storeId=${storeId}`),

  createShift: (body: CreateShiftRequest) =>
    pickerRequest<ShiftResponse>('/admin/picker/shifts', { method: 'POST', body }),

  updateShift: (shiftId: number, body: UpdateShiftRequest) =>
    pickerRequest<ShiftResponse>(`/admin/picker/shifts/${shiftId}`, { method: 'PUT', body }),

  deleteShift: (shiftId: number) =>
    pickerRequest<void>(`/admin/picker/shifts/${shiftId}`, { method: 'DELETE' }),

  listReconcileFailures: (page = 0, size = 50) =>
    pickerRequest<ReconciliationOutboxResponse[]>(`/admin/picker/reconcile/failures?page=${page}&size=${size}`),

  replayReconcile: (outboxId: number) =>
    pickerRequest<ReconciliationOutboxResponse>(`/admin/picker/reconcile/${outboxId}/replay`, { method: 'POST' })
};
