'use client';

import { getStoredToken, useAuth } from './store';
import type {
  QrCampaign,
  QrCampaignDetail,
  QrPlacement,
  QrAnalytics,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  AddPlacementRequest,
  UpdatePlacementRequest
} from './qrTypes';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.bunzodelivery.com';

export class QrApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'QrApiError';
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
    res = await fetch(`${BASE}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new QrApiError(0, 'Could not reach the server.');
  }

  if (res.status === 401) {
    useAuth.getState().logout();
    throw new QrApiError(401, 'Your session has expired. Please sign in again.');
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data &&
        (data as { error?: { message?: string } }).error?.message) ||
      `Request failed (${res.status})`;
    throw new QrApiError(res.status, message as string);
  }
  return data as T;
}

export const qrApi = {
  listCampaigns: () => req<QrCampaign[]>('/admin/qr/campaigns'),
  createCampaign: (body: CreateCampaignRequest) =>
    req<QrCampaign>('/admin/qr/campaigns', { method: 'POST', body }),
  getCampaign: (id: string) =>
    req<QrCampaignDetail>(`/admin/qr/campaigns/${encodeURIComponent(id)}`),
  updateCampaign: (id: string, body: UpdateCampaignRequest) =>
    req<QrCampaign>(`/admin/qr/campaigns/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  addPlacement: (id: string, body: AddPlacementRequest) =>
    req<QrPlacement>(`/admin/qr/campaigns/${encodeURIComponent(id)}/placements`, { method: 'POST', body }),
  updatePlacement: (id: string, slug: string, body: UpdatePlacementRequest) =>
    req<QrPlacement>(
      `/admin/qr/campaigns/${encodeURIComponent(id)}/placements/${encodeURIComponent(slug)}`,
      { method: 'PATCH', body }
    ),
  analytics: (id: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return req<QrAnalytics>(`/admin/qr/campaigns/${encodeURIComponent(id)}/analytics${suffix}`);
  }
};
