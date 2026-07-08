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
  status: PickTaskStatus;
  cancelledReason?: string | null;
  createdAt?: string;
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  elapsedMinutes?: number | null;
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
