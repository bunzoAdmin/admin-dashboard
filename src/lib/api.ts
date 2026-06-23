'use client';

import { getStoredToken, useAuth, type AdminUser } from './store';
import type {
  CashLedger,
  Disbursement,
  DriverDetail,
  EarningsSummary,
  LoginResponse,
  PresignResponse,
  ReferralScreen,
  Rule,
  StoreQR
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.bunzodelivery.com';

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

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFrom(res: Response, data: unknown, fallback: string): ApiClientError {
  const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
  return new ApiClientError(res.status, err?.code ?? 'ERROR', err?.message ?? fallback);
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getStoredToken();
  const url = new URL(`${BASE}/api/v1${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
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

  const data = await parseBody(res);

  if (!res.ok) {
    if (res.status === 401) {
      // Session expired or token rejected: clear it so the app routes to login.
      useAuth.getState().logout();
      throw errorFrom(res, data, 'Your session has expired. Please sign in again.');
    }
    throw errorFrom(res, data, `Request failed (${res.status}).`);
  }

  return data as T;
}

// login authenticates with username/password. It does not go through request()
// because a 401 here means bad credentials, not an expired session.
async function login(username: string, password: string): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Could not reach the server. Check the API base URL and that qcom is running.');
  }
  const data = await parseBody(res);
  if (!res.ok) {
    throw errorFrom(res, data, 'Login failed.');
  }
  return data as LoginResponse;
}

// Public endpoints (no admin auth). Used for store QR display kiosks.
async function publicRequest<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`);
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Could not reach the server. Check the API base URL and that qcom is running.');
  }
  const data = await parseBody(res);
  if (!res.ok) {
    throw errorFrom(res, data, `Request failed (${res.status}).`);
  }
  return data as T;
}

const encodePhone = (phone: string) => encodeURIComponent(phone.trim());

export const api = {
  // --- Auth + admin users ---
  login,
  getMe: () => request<AdminUser>(`/admin/me`),
  listUsers: () => request<AdminUser[]>(`/admin/users`),
  createUser: (body: { username: string; password: string; name: string }) =>
    request<AdminUser>(`/admin/users`, { method: 'POST', body }),
  changePassword: (username: string, password: string) =>
    request<void>(`/admin/users/${encodeURIComponent(username)}/password`, { method: 'POST', body: { password } }),

  // --- Store QR (public API, hourly rotation) ---
  getStoreQR: (storeId: string) => publicRequest<StoreQR>(`/stores/${encodeURIComponent(storeId.trim())}/qr`),

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
