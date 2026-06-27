'use client';

import type {
  BadgeResponse,
  BulkSyncRequest,
  BulkSyncResponse,
  CategoryResponse,
  CategoryTreeNode,
  CreateBadgeRequest,
  CreateCategoryRequest,
  ProductResponse,
  UpdateBadgeRequest,
  PagedProductResponse
} from './catalogTypes';

const CATALOG_BASE =
  process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL?.replace(/\/$/, '') ?? '';

export class CatalogApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CatalogApiError';
    this.status = status;
  }
}

function catalogConfigured(): boolean {
  return CATALOG_BASE.length > 0;
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

async function catalogRequest<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!catalogConfigured()) {
    throw new CatalogApiError(0, 'Catalog API URL is not configured. Set NEXT_PUBLIC_CATALOG_API_BASE_URL.');
  }

  const url = `${CATALOG_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new CatalogApiError(0, 'Could not reach the catalog server. Check NEXT_PUBLIC_CATALOG_API_BASE_URL.');
  }

  const data = await parseBody(res);

  if (!res.ok) {
    const msg =
      (data as { message?: string } | null)?.message ??
      (typeof data === 'string' ? data : `Catalog request failed (${res.status}).`);
    throw new CatalogApiError(res.status, msg);
  }

  return data as T;
}

async function catalogArray<T>(path: string): Promise<T[]> {
  const data = await catalogRequest<T[] | T>(path);
  return Array.isArray(data) ? data : data != null ? [data as T] : [];
}

export const catalogApi = {
  getCategoryTree: () => catalogArray<CategoryTreeNode>('/catalog/categories/tree'),

  createCategory: (body: CreateCategoryRequest) =>
    catalogRequest<CategoryResponse>('/catalog/categories', { method: 'POST', body }),

  getCategory: (id: number) => catalogRequest<CategoryResponse>(`/catalog/categories/${id}`),

  getAllProducts: () => catalogArray<ProductResponse>('/catalog/products/all'),

  getProductsByCategory: (categoryId: number, storeId: number, pageNum = 0, pageSize = 50) =>
    catalogRequest<PagedProductResponse>(
      `/catalog/products/category/${categoryId}?storeId=${storeId}&pageNum=${pageNum}&pageSize=${pageSize}`
    ),

  searchProducts: (q: string, limit = 50) =>
    catalogArray<ProductResponse>(`/catalog/products/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  getProductByBarcode: (barcode: string) =>
    catalogRequest<ProductResponse>(`/catalog/products/barcode/${encodeURIComponent(barcode.trim())}`),

  getProductById: (id: number, storeId: number) =>
    catalogRequest<ProductResponse>(`/catalog/products/${id}?storeId=${storeId}`),

  syncProducts: (body: BulkSyncRequest) =>
    catalogRequest<BulkSyncResponse>('/catalog/products/sync', { method: 'POST', body }),

  listBadges: (includeInactive = true) =>
    catalogArray<BadgeResponse>(`/catalog/badges?includeInactive=${includeInactive}`),

  getBadge: (code: string) =>
    catalogRequest<BadgeResponse>(`/catalog/badges/${encodeURIComponent(code)}`),

  createBadge: (body: CreateBadgeRequest) =>
    catalogRequest<BadgeResponse>('/catalog/badges', { method: 'POST', body }),

  updateBadge: (code: string, body: UpdateBadgeRequest) =>
    catalogRequest<BadgeResponse>(`/catalog/badges/${encodeURIComponent(code)}`, { method: 'PUT', body })
};

export function isCatalogNotFound(err: unknown): boolean {
  return err instanceof CatalogApiError && err.status === 404;
}
