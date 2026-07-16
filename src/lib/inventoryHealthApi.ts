'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';
import type {
  DiscrepancyDetailResponse,
  InventoryItemResponse,
  LocationStockResponse,
  ShelfLocationsResponse,
  StockMovementsPageResponse
} from './inventoryHealthTypes';

export class InventoryHealthApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'InventoryHealthApiError';
    this.status = status;
  }
}

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
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
    throw new InventoryHealthApiError(0, 'Could not reach the inventory service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new InventoryHealthApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Inventory request failed.')
    );
  }

  return data as T;
}

export const inventoryHealthApi = {
  getLowStock: (storeId: number) =>
    req<InventoryItemResponse[]>(`/inventory/low-stock?storeId=${storeId}`),

  getReplenishment: (storeId: number) =>
    req<InventoryItemResponse[]>(`/inventory/replenishment?storeId=${storeId}`),

  listDiscrepancies: (storeId: number, opts?: { status?: string; page?: number; size?: number }) => {
    const q = new URLSearchParams({ storeId: String(storeId) });
    if (opts?.status) q.set('status', opts.status);
    q.set('page', String(opts?.page ?? 0));
    q.set('size', String(opts?.size ?? 50));
    return req<DiscrepancyDetailResponse[]>(`/admin/inventory/discrepancies?${q}`);
  },

  getDiscrepancy: (id: number) =>
    req<DiscrepancyDetailResponse>(`/admin/inventory/discrepancies/${id}`),

  resolveDiscrepancy: (id: number, resolvedBy: string) =>
    req<DiscrepancyDetailResponse>(`/admin/inventory/discrepancies/${id}/resolve`, {
      method: 'POST',
      body: { resolvedBy }
    }),

  listMovements: (params: {
    storeId?: number;
    sku?: string;
    movementType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.storeId != null) q.set('storeId', String(params.storeId));
    if (params.sku) q.set('sku', params.sku);
    if (params.movementType) q.set('movementType', params.movementType);
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 50));
    return req<StockMovementsPageResponse>(`/admin/inventory/stock-movements?${q}`);
  },

  getStockByLocation: (storeId: number, locationCode: string) =>
    req<LocationStockResponse>(
      `/admin/inventory/by-location?storeId=${storeId}&locationCode=${encodeURIComponent(locationCode)}`
    ),

  listShelfLocations: (storeId: number) =>
    req<ShelfLocationsResponse>(`/admin/inventory/locations?storeId=${storeId}`)
};
