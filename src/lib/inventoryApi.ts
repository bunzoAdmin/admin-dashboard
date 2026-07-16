'use client';

import type {
  AddStockRequest,
  AddStockResponse,
  AdjustStockRequest,
  AdjustStockResponse,
  InventoryAvailabilityResponse,
  InventoryBinResponse,
  TransferStockRequest,
  TransferStockResponse
} from './inventoryTypes';
import { inventoryApiConfigured, inventoryApiUrl } from './inventoryApiConfig';

export class InventoryApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'InventoryApiError';
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

async function inventoryRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<T> {
  if (!configured()) {
    throw new InventoryApiError(0, 'Inventory API is not available.');
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(inventoryApiUrl(path), {
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

  getBins: (storeId: number, sku: string) =>
    inventoryRequest<InventoryBinResponse[]>(
      `/inventory/bins?storeId=${storeId}&sku=${encodeURIComponent(sku)}`
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
    }),

  adjustStock: (body: AdjustStockRequest, idempotencyKey = newIdempotencyKey()) =>
    inventoryRequest<AdjustStockResponse>('/inventory/stock/adjust', {
      method: 'POST',
      body,
      idempotencyKey
    })
};
