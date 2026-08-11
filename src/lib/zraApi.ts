'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';

export class ZraApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ZraApiError';
    this.status = status;
  }
}

export type ZraSyncMetaView = {
  lastReqDt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
};

export type ZraCodesStatus = {
  standardCodeCount?: number;
  itemClassCount?: number;
  codes?: ZraSyncMetaView;
  itemClass?: ZraSyncMetaView;
  purchases?: ZraSyncMetaView;
};

export type ZraStockStatus = {
  storeId?: number;
  bhfId?: string;
  jobId?: string;
  status?: string;
  lastSyncAt?: string | null;
  lastSyncStartedAt?: string | null;
  openingBalancePostedAt?: string | null;
  lastError?: string | null;
  started?: boolean;
  pendingOrFailedOutbox?: number;
};

export type ZraStockPreview = {
  storeId: number;
  pendingSales: number;
  pendingCredits: number;
  pendingPurchases: number;
  pendingAdjustments: number;
  pendingTotal: number;
  lastSyncAt?: string | null;
  openingBalancePostedAt?: string | null;
  lastSyncStatus?: string | null;
};

export type ZraBranchInfo = {
  storeId?: number | null;
  baseUrl?: string;
  tpin?: string;
  bhfId?: string;
  deviceSerialNo?: string;
  legalName?: string;
  address?: string;
  phone?: string;
};

export type ZraOverview = {
  zraEnabled?: boolean;
  storeId?: number | null;
  message?: string | null;
  codes: ZraCodesStatus;
  pendingPurchases: number;
  stock: ZraStockStatus | Record<string, never>;
  branch?: ZraBranchInfo | null;
  enabledStoreIds?: number[];
};

export type ZraStandardCode = {
  id: number;
  cdCls?: string;
  cd?: string;
  cdNm?: string;
  cdDesc?: string;
  useYn?: string;
  syncedAt?: string | null;
};

export type ZraItemClassCode = {
  id: number;
  itemClsCd?: string;
  itemClsNm?: string;
  itemClsLvl?: number;
  taxTyCd?: string;
  useYn?: string;
  mjrTgNm?: string;
  syncedAt?: string | null;
};

export type ZraCategoryMapping = {
  id: number;
  categoryId: number;
  taxTyCd?: string;
  itemClsCd?: string;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ZraSkuMapping = {
  id: number;
  sku: string;
  taxTyCd?: string;
  itemClsCd?: string;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ZraMappingBody = {
  taxTyCd?: string;
  itemClsCd?: string;
  notes?: string;
  active?: boolean;
};

export type ZraPurchase = {
  id: number;
  storeId?: number | null;
  source?: string;
  status?: string;
  spplrTpin?: string;
  spplrNm?: string;
  spplrBhfId?: string;
  spplrInvcNo?: string;
  cisInvcNo?: string;
  invcNo?: number | null;
  pchsDt?: string;
  pmtTyCd?: string;
  totItemCnt?: number;
  totTaxblAmt?: number;
  totTaxAmt?: number;
  totAmt?: number;
  remark?: string | null;
  paperReceiptRef?: string | null;
  lastError?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ZraPurchaseLine = {
  id: number;
  purchaseId: number;
  itemSeq?: number;
  spplrItemCd?: string;
  spplrItemNm?: string;
  itemCd?: string | null;
  itemClsCd?: string | null;
  itemNm?: string;
  retrievedQty?: number;
  approvedQty?: number | null;
  prc?: number;
  totAmt?: number;
  taxTyCd?: string | null;
};

export type ZraPurchaseDetail = {
  purchase: ZraPurchase;
  lines: ZraPurchaseLine[];
};

export type ZraPurchasePage = {
  content: ZraPurchase[];
  totalElements: number;
  page: number;
  size: number;
};

export type ApprovePurchaseBody = {
  storeId: number;
  paperReceiptRef?: string;
  approvedQtyByLineId?: Record<number, number>;
};

export type ManualPurchaseLine = {
  itemCd: string;
  itemNm: string;
  qty: number;
  unitPriceInclusive: number;
};

export type ManualPurchaseBody = {
  storeId: number;
  spplrNm?: string;
  spplrTpin?: string;
  spplrBhfId?: string;
  spplrInvcNo?: string;
  pchsDt?: string;
  pmtTyCd?: string;
  remark?: string;
  paperReceiptRef?: string;
  lines: ManualPurchaseLine[];
};

export type CreditNoteBody = {
  reasonCd?: string;
  reason?: string;
  fullCredit?: boolean;
  lines?: { sku: string; qty: number }[];
};

export type ZraCreditNote = {
  id: number;
  orderId?: number;
  orderNumber?: string;
  seq?: number;
  invcNo?: number;
  orgInvcNo?: number;
  rcptNo?: string;
  status?: string;
  creditReasonCd?: string;
  creditReason?: string;
  creditedAmount?: number;
  creditedTaxAmount?: number;
  lineItemsJson?: string | null;
  lastError?: string | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
};

export type ZraAuditLog = {
  id: number;
  action?: string;
  entityType?: string;
  entityId?: string | null;
  storeId?: number | null;
  adminUser?: string;
  detailJson?: string | null;
  createdAt?: string | null;
};

export type ZraAuditPage = {
  content: ZraAuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type ZraVatRow = {
  docType: string;
  id?: number;
  orderNumber?: string;
  invcNo?: number | null;
  rcptNo?: string;
  issuedAt?: string | null;
  storeId?: number | null;
  customerName?: string;
  description?: string;
  taxableAmount?: number;
  vatAmount?: number;
  totalInclusive?: number;
  taxSource?: string;
};

export type ZraVatReport = {
  from?: string;
  to?: string;
  storeId?: number | null;
  totalElements: number;
  truncated?: boolean;
  recomputedSalesCount?: number;
  content: ZraVatRow[];
};

export type BulkRegisterZraItemResult = {
  itemCd: string;
  itemNm?: string;
  taxTyCd?: string;
  itemClsCd?: string;
  status: 'REGISTERED' | 'ALREADY_EXISTS' | 'FAILED' | 'WOULD_REGISTER' | 'SKIPPED' | string;
  message?: string;
  fromMapping?: boolean;
};

export type BulkRegisterZraItemsResponse = {
  dryRun: boolean;
  total: number;
  registered: number;
  alreadyExists: number;
  failed: number;
  skipped: number;
  results: BulkRegisterZraItemResult[];
};

export type ZraFinanceAccess = {
  financeAdmin?: boolean;
  allowlistRequired?: boolean;
};

async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown; adminUser?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.adminUser) headers['X-Admin-User'] = opts.adminUser;

  let res: Response;
  try {
    res = await fetch(inventoryApiUrl(path), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new ZraApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new ZraApiError(res.status, inventoryApiErrorMessage(data, res.status, 'ZRA request failed.'));
  }

  return data as T;
}

function mutateOpts(adminUser: string | undefined, body?: unknown) {
  return {
    method: 'POST' as const,
    body,
    adminUser: adminUser?.trim() || undefined
  };
}

export const zraApi = {
  getOverview: (storeId?: number) => {
    const q = new URLSearchParams();
    if (storeId != null) q.set('storeId', String(storeId));
    const qs = q.toString();
    return req<ZraOverview>(`/admin/zra/overview${qs ? `?${qs}` : ''}`);
  },

  syncCodes: (storeId?: number, adminUser?: string) => {
    const q = new URLSearchParams();
    if (storeId != null) q.set('storeId', String(storeId));
    const qs = q.toString();
    return req<Record<string, unknown>>(
      `/admin/zra/codes/sync${qs ? `?${qs}` : ''}`,
      mutateOpts(adminUser)
    );
  },

  getCodesStatus: (storeId?: number) => {
    const q = new URLSearchParams();
    if (storeId != null) q.set('storeId', String(storeId));
    const qs = q.toString();
    return req<ZraCodesStatus>(`/admin/zra/codes/status${qs ? `?${qs}` : ''}`);
  },

  listBranches: () => req<ZraBranchInfo[]>('/admin/zra/branches'),

  getBranch: (storeId: number) => req<ZraBranchInfo>(`/admin/zra/branches/${storeId}`),

  listStandardCodes: (params: { cdCls?: string; q?: string; page?: number; size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.cdCls) q.set('cdCls', params.cdCls);
    if (params.q) q.set('q', params.q);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 50));
    return req<ZraStandardCode[]>(`/admin/zra/codes/standard?${q}`);
  },

  listClassificationCodes: (params: { q?: string; page?: number; size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 50));
    return req<ZraItemClassCode[]>(`/admin/zra/codes/classification?${q}`);
  },

  listCategoryMappings: () => req<ZraCategoryMapping[]>('/admin/zra/mappings/categories'),

  upsertCategoryMapping: (categoryId: number, body: ZraMappingBody, adminUser?: string) =>
    req<ZraCategoryMapping>(`/admin/zra/mappings/categories/${categoryId}`, {
      method: 'PUT',
      body,
      adminUser: adminUser?.trim() || undefined
    }),

  listSkuMappings: (params: { q?: string; activeOnly?: boolean; page?: number; size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.activeOnly != null) q.set('activeOnly', String(params.activeOnly));
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 50));
    return req<ZraSkuMapping[]>(`/admin/zra/mappings/skus?${q}`);
  },

  upsertSkuMapping: (sku: string, body: ZraMappingBody, adminUser?: string) =>
    req<ZraSkuMapping>(`/admin/zra/mappings/skus/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      body,
      adminUser: adminUser?.trim() || undefined
    }),

  fetchPurchases: (storeId?: number, adminUser?: string) => {
    const q = new URLSearchParams();
    if (storeId != null) q.set('storeId', String(storeId));
    const qs = q.toString();
    return req<Record<string, unknown>>(
      `/admin/zra/purchases/fetch${qs ? `?${qs}` : ''}`,
      mutateOpts(adminUser)
    );
  },

  listPurchases: (
    params: { status?: string; source?: string; storeId?: number; page?: number; size?: number } = {}
  ) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.source) q.set('source', params.source);
    if (params.storeId != null) q.set('storeId', String(params.storeId));
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 50));
    return req<ZraPurchasePage>(`/admin/zra/purchases?${q}`);
  },

  getPurchase: (id: number) => req<ZraPurchaseDetail>(`/admin/zra/purchases/${id}`),

  approvePurchase: (id: number, body: ApprovePurchaseBody, adminUser?: string) =>
    req<ZraPurchase>(`/admin/zra/purchases/${id}/approve`, mutateOpts(adminUser, body)),

  rejectPurchase: (id: number, reason: string, adminUser?: string) =>
    req<ZraPurchase>(`/admin/zra/purchases/${id}/reject`, mutateOpts(adminUser, { reason })),

  mapPurchaseLine: (purchaseId: number, lineId: number, sku: string, adminUser?: string) =>
    req<ZraPurchaseLine>(
      `/admin/zra/purchases/${purchaseId}/lines/${lineId}/map`,
      mutateOpts(adminUser, { sku })
    ),

  createManualPurchase: (body: ManualPurchaseBody, adminUser?: string) =>
    req<ZraPurchase>('/admin/zra/purchases/manual', mutateOpts(adminUser, body)),

  getStockSyncStatus: (storeId: number) =>
    req<ZraStockStatus>(`/admin/zra/stock/sync-status?storeId=${storeId}`),

  getStockPreview: (storeId: number) =>
    req<ZraStockPreview>(`/admin/zra/stock/preview?storeId=${storeId}`),

  syncStock: (storeId: number, adminUser?: string) =>
    req<ZraStockStatus>('/admin/zra/stock/sync', mutateOpts(adminUser, { storeId })),

  postOpeningBalance: (storeId: number, adminUser?: string) =>
    req<Record<string, unknown>>('/admin/zra/stock/opening-balance', mutateOpts(adminUser, { storeId })),

  issueCreditNote: (orderNumber: string, body: CreditNoteBody, adminUser?: string) =>
    req<ZraCreditNote>(
      `/admin/zra/invoices/${encodeURIComponent(orderNumber)}/credit-note`,
      mutateOpts(adminUser, body)
    ),

  listCreditNotes: (orderNumber: string) =>
    req<ZraCreditNote[]>(`/admin/zra/orders/${encodeURIComponent(orderNumber)}/credit-notes`),

  fetchCreditNotePdfBlobUrl: async (id: number): Promise<string> => {
    const headers: Record<string, string> = {};
    const token = getStoredToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(inventoryApiUrl(`/admin/zra/credit-notes/${id}/pdf`), { headers });
    } catch {
      throw new ZraApiError(0, 'Could not reach the order service.');
    }
    if (!res.ok) {
      const data = await parseResponseBody(res);
      throw new ZraApiError(
        res.status,
        inventoryApiErrorMessage(data, res.status, 'Could not load credit note PDF.')
      );
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  checkFinanceAccess: (adminUser: string) =>
    req<ZraFinanceAccess>('/admin/zra/access', { adminUser: adminUser.trim() }),

  registerItems: (body?: {
    storeId?: number;
    skus?: string[];
    includeFeeItem?: boolean;
    dryRun?: boolean;
    adminUser?: string;
  }) =>
    req<BulkRegisterZraItemsResponse>('/admin/zra/items/register', {
      method: 'POST',
      body: {
        storeId: body?.storeId,
        skus: body?.skus,
        includeFeeItem: body?.includeFeeItem,
        dryRun: body?.dryRun
      },
      adminUser: body?.adminUser?.trim() || undefined
    }),

  listAudit: (params: {
    storeId?: number;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.storeId != null) q.set('storeId', String(params.storeId));
    if (params.action) q.set('action', params.action);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 50));
    return req<ZraAuditPage>(`/admin/zra/audit?${q}`);
  },

  getVatReport: (params: { storeId?: number; from: string; to: string }) => {
    const q = new URLSearchParams();
    if (params.storeId != null) q.set('storeId', String(params.storeId));
    q.set('from', params.from);
    q.set('to', params.to);
    return req<ZraVatReport>(`/admin/zra/reports/vat?${q}`);
  },

  downloadVatCsv: async (params: { storeId?: number; from: string; to: string }): Promise<void> => {
    const headers: Record<string, string> = {};
    const token = getStoredToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const q = new URLSearchParams();
    if (params.storeId != null) q.set('storeId', String(params.storeId));
    q.set('from', params.from);
    q.set('to', params.to);

    let res: Response;
    try {
      res = await fetch(inventoryApiUrl(`/admin/zra/reports/vat.csv?${q}`), { headers });
    } catch {
      throw new ZraApiError(0, 'Could not reach the order service.');
    }
    if (!res.ok) {
      const data = await parseResponseBody(res);
      throw new ZraApiError(
        res.status,
        inventoryApiErrorMessage(data, res.status, 'VAT CSV export failed.')
      );
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `zra-vat-${params.from.slice(0, 10)}-to-${params.to.slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
};
