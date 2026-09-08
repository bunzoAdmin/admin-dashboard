'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';
import type { CreatePromotionRequest, PatchPromotionRequest, Promotion } from './promotionAdminTypes';

export class PromotionAdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PromotionAdminApiError';
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
    throw new PromotionAdminApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new PromotionAdminApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Promotion request failed.')
    );
  }

  return data as T;
}

export const promotionAdminApi = {
  list: () => req<Promotion[]>('/admin/promotions'),
  get: (id: number) => req<Promotion>(`/admin/promotions/${id}`),
  create: (body: CreatePromotionRequest) =>
    req<Promotion>('/admin/promotions', { method: 'POST', body }),
  patch: (id: number, body: PatchPromotionRequest) =>
    req<Promotion>(`/admin/promotions/${id}`, { method: 'PATCH', body }),
  remove: (id: number) => req<void>(`/admin/promotions/${id}`, { method: 'DELETE' })
};
