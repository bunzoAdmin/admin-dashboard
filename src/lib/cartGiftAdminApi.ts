'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';
import type { CartGift, CreateCartGiftRequest, PatchCartGiftRequest } from './cartGiftAdminTypes';

export class CartGiftAdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CartGiftAdminApiError';
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
    throw new CartGiftAdminApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new CartGiftAdminApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Cart gift request failed.')
    );
  }

  return data as T;
}

export const cartGiftAdminApi = {
  list: () => req<CartGift[]>('/admin/cart-gifts'),
  get: (id: number) => req<CartGift>(`/admin/cart-gifts/${id}`),
  create: (body: CreateCartGiftRequest) =>
    req<CartGift>('/admin/cart-gifts', { method: 'POST', body }),
  patch: (id: number, body: PatchCartGiftRequest) =>
    req<CartGift>(`/admin/cart-gifts/${id}`, { method: 'PATCH', body }),
  remove: (id: number) => req<void>(`/admin/cart-gifts/${id}`, { method: 'DELETE' })
};
