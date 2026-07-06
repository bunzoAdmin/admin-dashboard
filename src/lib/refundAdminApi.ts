'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';

export interface StuckRefundEntry {
  refundId: string;
  orderNumber: string;
  orderUuid: string;
  amount: number;
  currency: string;
  gateway: string;
  status: string;
  retryCount: number;
  failureReason?: string | null;
  createdAt?: string | null;
}

export class RefundAdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'RefundAdminApiError';
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
    throw new RefundAdminApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new RefundAdminApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Refund request failed.')
    );
  }

  return data as T;
}

export const refundAdminApi = {
  listStuck: () => req<StuckRefundEntry[]>('/admin/refunds/stuck'),

  retry: (refundId: string) =>
    req<StuckRefundEntry>(`/admin/refunds/${encodeURIComponent(refundId)}/retry`, { method: 'POST' })
};
