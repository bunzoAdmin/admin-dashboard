'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';
import type { CouponDefinition, CreateCouponRequest, PatchCouponRequest } from './couponAdminTypes';

export class CouponAdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CouponAdminApiError';
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
    throw new CouponAdminApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new CouponAdminApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Coupon request failed.')
    );
  }

  return data as T;
}

export const couponAdminApi = {
  list: () => req<CouponDefinition[]>('/admin/coupons'),

  get: (code: string) => req<CouponDefinition>(`/admin/coupons/${encodeURIComponent(code)}`),

  create: (body: CreateCouponRequest) =>
    req<CouponDefinition>('/admin/coupons', { method: 'POST', body }),

  patch: (code: string, body: PatchCouponRequest) =>
    req<CouponDefinition>(`/admin/coupons/${encodeURIComponent(code)}`, { method: 'PATCH', body }),

  remove: (code: string) =>
    req<void>(`/admin/coupons/${encodeURIComponent(code)}`, { method: 'DELETE' })
};
