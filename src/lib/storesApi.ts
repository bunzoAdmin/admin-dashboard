'use client';

import { getStoredToken } from './store';
import type { StoreResponse } from './pickerTypes';

const BASE = process.env.NEXT_PUBLIC_ORDER_API_BASE_URL?.replace(/\/$/, '') ?? '';

export class StoresApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'StoresApiError';
    this.status = status;
  }
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

export async function listStores(): Promise<StoreResponse[]> {
  if (!BASE) throw new StoresApiError(0, 'API URL is not configured.');

  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/admin/stores`, { headers });
  } catch {
    throw new StoresApiError(0, 'Could not reach stores API.');
  }

  const data = await parseBody(res);
  if (!res.ok) {
    const msg = (data as { message?: string } | null)?.message ?? `Request failed (${res.status}).`;
    throw new StoresApiError(res.status, msg);
  }

  return Array.isArray(data) ? (data as StoreResponse[]) : [];
}
