'use client';

import { getStoredToken, useAuth, type AdminUser } from './store';
import type {
  AdminDispute,
  AdminDisputeDetail,
  CashLedger,
  Darkstore,
  Disbursement,
  DisputeListResponse,
  DisputeStatus,
  DisputeSummary,
  DriverDetail,
  DriverListResponse,
  DriverTripResponse,
  EarningsSummary,
  InKindDisbursementsResponse,
  LoginResponse,
  PresenceResponse,
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
  // Lists drivers assigned to a darkstore, ordered by name. Pass storeId
  // 'UNASSIGNED' (or '') for drivers with no assigned store; name is an optional
  // case-insensitive prefix filter; cursor drives pagination.
  listDrivers: (params: { assigned_store_id: string; name?: string; cursor?: string; limit?: number }) =>
    request<DriverListResponse>(`/admin/drivers`, {
      query: {
        assigned_store_id: params.assigned_store_id || 'UNASSIGNED',
        name: params.name,
        cursor: params.cursor,
        limit: params.limit ? String(params.limit) : undefined
      }
    }),
  getDriver: (phone: string) => request<DriverDetail>(`/admin/drivers/${encodePhone(phone)}`),
  updateDriverAssignedStore: (phone: string, assignedStoreId: string) =>
    request<{ phone_number: string; assigned_store_id: string }>(
      `/admin/drivers/${encodePhone(phone)}/assigned-store`,
      { method: 'PATCH', body: { assigned_store_id: assignedStoreId } }
    ),
  getDriverTrip: (phone: string) => request<DriverTripResponse>(`/admin/drivers/${encodePhone(phone)}/trip`),
  adminCompletePickup: (phone: string) =>
    request<{ status: string }>(`/admin/drivers/${encodePhone(phone)}/trip/pickup/complete`, { method: 'POST' }),
  adminCompleteDrop: (phone: string, otp: string) =>
    request<{ status: string }>(`/admin/drivers/${encodePhone(phone)}/trip/drop/complete`, {
      method: 'POST',
      body: { otp }
    }),
  getDriverEarnings: (phone: string, cursor?: string) =>
    request<EarningsSummary>(`/admin/drivers/${encodePhone(phone)}/earnings`, { query: { cursor } }),
  getDriverDisbursements: (phone: string) =>
    request<{ disbursements: Disbursement[] }>(`/admin/drivers/${encodePhone(phone)}/disbursements`),
  getDriverReferrals: (phone: string) =>
    request<ReferralScreen>(`/admin/drivers/${encodePhone(phone)}/referrals`),
  getDriverCashLedger: (phone: string) =>
    request<CashLedger>(`/admin/drivers/${encodePhone(phone)}/cash-ledger`),
  getDriverPresence: (phone: string, date?: string) =>
    request<PresenceResponse>(`/admin/drivers/${encodePhone(phone)}/presence`, { query: { date } }),
  recordInKindDisbursement: (phone: string, body: { sku: string; quantity: number; notes?: string }) =>
    request<{ disbursement_id: string; sku: string; quantity: number; disbursed_at: string }>(
      `/admin/drivers/${encodePhone(phone)}/inkind-disbursements`,
      { method: 'POST', body }
    ),
  listInKindDisbursements: (phone: string) =>
    request<InKindDisbursementsResponse>(`/admin/drivers/${encodePhone(phone)}/inkind-disbursements`),

  // --- Onboarding ---
  presignDriverDoc: (body: { kind: 'profile' | 'nrc' | 'license'; phone: string; file_name: string; file_type: string; file_size: number }) =>
    request<PresignResponse>(`/admin/uploads/url`, { method: 'POST', body }),
  createDriver: (body: {
    phone_number: string;
    name: string;
    profile_url: string;
    nrc_url: string;
    driver_license_url: string;
    nrc_number: string;
    airtel_money_number: string;
    bike_number: string;
    bike_brand: string;
    assigned_store_id: string;
    referral_code?: string;
  }) => request<{ de_id: string; phone_number: string; status: string }>(`/admin/drivers`, { method: 'POST', body }),
  listDarkstores: (opts?: { all?: boolean }) =>
    request<{ darkstores: Darkstore[] }>(`/admin/darkstores`, {
      query: { all: opts?.all ? 'true' : undefined }
    }),
  createDarkstore: (body: {
    name: string;
    latitude: number;
    longitude: number;
    polygon?: string; // raw "lat,lng"-per-line text; omit/empty = no polygon
    opens_at: string;
    closes_at: string;
  }) => request<{ darkstore_id: string; name: string; is_active: boolean }>(`/admin/darkstores`, { method: 'POST', body }),
  // Lists darkstores for pickers. Defaults to all (active + inactive) so the
  // manage page can select inactive stores too; pass { all: false } for active only.
  listDarkstores: (opts?: { all?: boolean }) =>
    request<{ darkstores: Darkstore[] }>(`/admin/darkstores`, {
      query: { all: opts?.all === false ? undefined : 'true' }
    }),
  getDarkstore: (id: string) => request<Darkstore>(`/admin/darkstores/${encodeURIComponent(id)}`),
  updateDarkstore: (
    id: string,
    body: {
      name?: string;
      latitude?: number;
      longitude?: number;
      polygon?: string;
      opens_at?: string;
      closes_at?: string;
      presence_radius_meters?: number;
    }
  ) => request<Darkstore>(`/admin/darkstores/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  activateDarkstore: (id: string) =>
    request<Darkstore>(`/admin/darkstores/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
  deactivateDarkstore: (id: string) =>
    request<Darkstore>(`/admin/darkstores/${encodeURIComponent(id)}/deactivate`, { method: 'POST' }),

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
  deleteRule: (id: string) => request<Rule>(`/admin/rules/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // --- Disputes ---
  listDisputes: (status: DisputeStatus, cursor?: string) =>
    request<DisputeListResponse>(`/admin/disputes`, { query: { status, cursor } }),
  getDisputeSummary: () => request<DisputeSummary>(`/admin/disputes/summary`),
  getDispute: (id: string) =>
    request<{ dispute: AdminDisputeDetail }>(`/admin/disputes/${encodeURIComponent(id)}`),
  updateDispute: (id: string, body: { status: DisputeStatus; resolution_note?: string }) =>
    request<{ dispute: AdminDispute }>(`/admin/disputes/${encodeURIComponent(id)}`, { method: 'PATCH', body })
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
