'use client';

import type {
  BadgeResponse,
  BarcodeEntryResponse,
  BulkSyncRequest,
  BulkSyncResponse,
  CategoryResponse,
  CategoryTreeNode,
  CreateBadgeRequest,
  CreateCategoryRequest,
  GenerateBarcodeRequest,
  PagedBarcodeResponse,
  PagedProductResponse,
  ProductResponse,
  UpdateBadgeRequest,
  UpdateCategoryRequest
} from './catalogTypes';
import { INVENTORY_API_BASE_URL, inventoryApiConfigured } from './inventoryApiConfig';

export interface ImageUploadResponse {
  r2Key: string;
}

export class CatalogApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CatalogApiError';
    this.status = status;
  }
}

function catalogConfigured(): boolean {
  return inventoryApiConfigured();
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

function errorMessageFromBody(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string') {
    return (data as { message: string }).message;
  }
  return typeof data === 'string' && data.trim() ? data : fallback;
}

async function catalogRequest<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!catalogConfigured()) {
    throw new CatalogApiError(0, 'Catalog API URL is not configured. Set NEXT_PUBLIC_INVENTORY_API_BASE_URL.');
  }

  const url = `${INVENTORY_API_BASE_URL}/api/v1${path}`;
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
    throw new CatalogApiError(
      0,
      'Could not reach the catalog server. If the dashboard is HTTPS, you cannot call http:// backends directly — use Next route handlers (set NEXT_PUBLIC_INVENTORY_API_BASE_URL to this app URL and PRODUCT_SERVICE_PROXY_TARGET to product-service). Otherwise check CORS on product-service and that the host is reachable.'
    );
  }

  const data = await parseBody(res);

  if (!res.ok) {
    const msg = errorMessageFromBody(data, `Catalog request failed (${res.status}).`);
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

  updateCategory: (id: number, body: UpdateCategoryRequest) =>
    catalogRequest<CategoryResponse>(`/catalog/categories/${id}`, { method: 'PUT', body }),

  deleteCategory: (id: number) =>
    catalogRequest<void>(`/catalog/categories/${id}`, { method: 'DELETE' }),

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
    catalogRequest<BadgeResponse>(`/catalog/badges/${encodeURIComponent(code)}`, { method: 'PUT', body }),

  // ── Barcode generator ──────────────────────────────────────────────────────

  generateBarcode: (body: GenerateBarcodeRequest) =>
    catalogRequest<BarcodeEntryResponse>('/catalog/barcodes/generate', { method: 'POST', body }),

  listBarcodes: (params: { page?: number; size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.page != null) q.set('page', String(params.page));
    if (params.size != null) q.set('size', String(params.size));
    const qs = q.toString();
    return catalogRequest<PagedBarcodeResponse>(`/catalog/barcodes${qs ? '?' + qs : ''}`);
  },

  uploadImage: async (
    file: File,
    opts: { scope: 'category' | 'product'; slug: string; index?: number }
  ): Promise<string> => {
    if (!catalogConfigured()) {
      throw new CatalogApiError(0, 'Catalog API URL is not configured. Set NEXT_PUBLIC_INVENTORY_API_BASE_URL.');
    }

    const params = new URLSearchParams({ scope: opts.scope, slug: opts.slug.trim() });
    if (opts.index != null) params.set('index', String(opts.index));

    const form = new FormData();
    form.append('image', file);

    let res: Response;
    try {
      res = await fetch(`${INVENTORY_API_BASE_URL}/api/v1/images/upload?${params}`, {
        method: 'POST',
        body: form
      });
    } catch {
      throw new CatalogApiError(0, 'Could not reach the image upload server.');
    }

    const data = await parseBody(res);
    if (!res.ok) {
      throw new CatalogApiError(res.status, errorMessageFromBody(data, `Image upload failed (${res.status}).`));
    }

    const r2Key = (data as ImageUploadResponse | null)?.r2Key;
    if (!r2Key) {
      throw new CatalogApiError(0, 'Upload succeeded but no r2Key was returned.');
    }
    return r2Key;
  }
};

export function isCatalogNotFound(err: unknown): boolean {
  return err instanceof CatalogApiError && err.status === 404;
}
