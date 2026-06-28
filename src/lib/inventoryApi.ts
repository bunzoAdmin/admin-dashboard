'use client';

import type {
  AddStockRequest,
  AddStockResponse,
  InventoryAvailabilityResponse,
  TransferStockRequest,
  TransferStockResponse
} from './inventoryTypes';

const API_BASE = process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL?.replace(/\/$/, '') ?? 'http://15.135.73.205:8081';

export class InventoryApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'InventoryApiError';
    this.status = status;
  }
}

function configured(): boolean {
  return API_BASE.length > 0;
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

async function inventoryRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<T> {
  if (!configured()) {
    throw new InventoryApiError(0, 'API URL is not configured. Set NEXT_PUBLIC_CATALOG_API_BASE_URL.');
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new InventoryApiError(0, 'Could not reach the inventory server.');
  }

  const data = await parseBody(res);
  if (!res.ok) {
    const msg =
      (data as { message?: string } | null)?.message ??
      (typeof data === 'string' ? data : `Inventory request failed (${res.status}).`);
    throw new InventoryApiError(res.status, msg);
  }

  return data as T;
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const inventoryApi = {
  getAvailability: (storeId: number, sku: string) =>
    inventoryRequest<InventoryAvailabilityResponse>(
      `/inventory/availability/single?storeId=${storeId}&sku=${encodeURIComponent(sku)}`
    ),

  addStock: (body: AddStockRequest, idempotencyKey = newIdempotencyKey()) =>
    inventoryRequest<AddStockResponse>('/inventory/stock/add', {
      method: 'POST',
      body,
      idempotencyKey
    }),

  transferStock: (body: TransferStockRequest, idempotencyKey = newIdempotencyKey()) =>
    inventoryRequest<TransferStockResponse>('/inventory/stock/transfer', {
      method: 'POST',
      body,
      idempotencyKey
    })
};
