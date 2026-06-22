'use client';

import { getStoredAdminKey, getStoredAdminLabel } from './store';
import type {
  CashLedger,
  Disbursement,
  DriverDetail,
  EarningsSummary,
  PresignResponse,
  ReferralScreen,
  Rule
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.bunzodeliver.com';

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const key = getStoredAdminKey();
  const url = new URL(`${BASE}/api/v1${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    'X-Admin-Key': key ?? '',
    'X-Admin-Label': getStoredAdminLabel()
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Could not reach the server. Check the API base URL and that qcom is running.');
  }

  if (res.status === 204) return undefined as T;

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
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401) {
      throw new ApiClientError(401, err?.code ?? 'UNAUTHORIZED', err?.message ?? 'Invalid admin key.');
    }
    throw new ApiClientError(res.status, err?.code ?? 'ERROR', err?.message ?? `Request failed (${res.status}).`);
  }

  return data as T;
}

const encodePhone = (phone: string) => encodeURIComponent(phone.trim());

export const api = {
  // --- Driver lookup + detail ---
  getDriver: (phone: string) => request<DriverDetail>(`/admin/drivers/${encodePhone(phone)}`),
  getDriverEarnings: (phone: string, cursor?: string) =>
    request<EarningsSummary>(`/admin/drivers/${encodePhone(phone)}/earnings`, { query: { cursor } }),
  getDriverDisbursements: (phone: string) =>
    request<{ disbursements: Disbursement[] }>(`/admin/drivers/${encodePhone(phone)}/disbursements`),
  getDriverReferrals: (phone: string) =>
    request<ReferralScreen>(`/admin/drivers/${encodePhone(phone)}/referrals`),
  getDriverCashLedger: (phone: string) =>
    request<CashLedger>(`/admin/drivers/${encodePhone(phone)}/cash-ledger`),

  // --- Onboarding ---
  presignDriverDoc: (body: { kind: 'profile' | 'nrc' | 'license'; phone: string; file_name: string; file_type: string; file_size: number }) =>
    request<PresignResponse>(`/admin/uploads/url`, { method: 'POST', body }),
  createDriver: (body: {
    phone_number: string;
    name: string;
    profile_url: string;
    nrc_url: string;
    driver_license_url: string;
    referral_code?: string;
  }) => request<{ de_id: string; phone_number: string; status: string }>(`/admin/drivers`, { method: 'POST', body }),

  // --- Assignment ---
  assignOrder: (order_id: string, driver_phone: string) =>
    request<{ status: string }>(`/admin/assign`, { method: 'POST', body: { order_id, driver_phone } }),

  // --- Cash + disbursement ---
  recordCashDeposit: (phone: string, body: { amount_zmw: number; deposit_id: string }) =>
    request<unknown>(`/admin/de/${encodePhone(phone)}/cash-deposit`, { method: 'POST', body }),
  recordDisbursement: (
    deId: string,
    body: { amount_zmw: number; period_from: string; period_to: string; de_phone: string }
  ) => request<{ disbursement_id: string }>(`/admin/de/${encodeURIComponent(deId)}/disbursement`, { method: 'POST', body }),

  // --- Payout rules ---
  listRules: () => request<Rule[]>(`/admin/rules`),
  listRuleVersions: (id: string) => request<Rule[]>(`/admin/rules/${encodeURIComponent(id)}/versions`),
  createRule: (rule: Rule) => request<Rule>(`/admin/rules`, { method: 'POST', body: rule }),
  updateRule: (id: string, rule: Rule) => request<Rule>(`/admin/rules/${encodeURIComponent(id)}`, { method: 'PUT', body: rule }),
  deleteRule: (id: string) => request<Rule>(`/admin/rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
};

// Uploads a file directly to S3 using a presigned PUT URL.
export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });
  if (!res.ok) {
    throw new ApiClientError(res.status, 'UPLOAD_FAILED', `S3 upload failed (${res.status}).`);
  }
}
