'use client';

import type {
  BadgeResponse,
  BannerResponse,
  BannerSlotResponse,
  AssignBannerToSlotRequest,
  CreateBannerRequest,
  CreateBannerSlotRequest,
  ReorderBannerSlotRequest,
  UpdateBannerRequest,
  UpdateBannerSlotRequest,
  AddShowcaseItemsRequest,
  AddCategoryShowcaseItemsRequest,
  CreateCategoryShowcaseGroupRequest,
  CreateShowcaseGroupRequest,
  CategoryShowcaseGroupResponse,
  CategoryShowcaseTypeOption,
  ReorderCategoryShowcaseItemsRequest,
  ReorderShowcaseItemsRequest,
  ShowcaseGroupResponse,
  ShowcaseTypeOption,
  UpdateCategoryShowcaseGroupRequest,
  UpdateShowcaseGroupRequest,
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
import { inventoryApiConfigured, inventoryApiUrl } from './inventoryApiConfig';

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
    throw new CatalogApiError(0, 'Catalog API is not available.');
  }

  const url = inventoryApiUrl(path);
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
      'Could not reach the catalog API. Ensure PRODUCT_SERVICE_PROXY_TARGET is set on the server (e.g. https://api.bunzodelivery.com/product-service) and redeploy. If you still have NEXT_PUBLIC_CATALOG_API_BASE_URL pointing at http://, remove it — the browser should use same-origin /api/v1 routes.'
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

  getProductById: (id: number, storeId?: number) => {
    const q = storeId != null ? `?storeId=${storeId}` : '';
    return catalogRequest<ProductResponse>(`/catalog/products/${id}${q}`);
  },

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

  // ── Banners ────────────────────────────────────────────────────────────────

  listBanners: () =>
    catalogArray<BannerResponse>('/admin/banners'),

  getBanner: (id: number) =>
    catalogRequest<BannerResponse>(`/admin/banners/${id}`),

  createBanner: (body: CreateBannerRequest) =>
    catalogRequest<BannerResponse>('/admin/banners', { method: 'POST', body }),

  updateBanner: (id: number, body: UpdateBannerRequest) =>
    catalogRequest<BannerResponse>(`/admin/banners/${id}`, { method: 'PUT', body }),

  deleteBanner: (id: number) =>
    catalogRequest<void>(`/admin/banners/${id}`, { method: 'DELETE' }),

  // ── Banner Slots ───────────────────────────────────────────────────────────

  listBannerSlots: () =>
    catalogArray<BannerSlotResponse>('/admin/banner-slots'),

  getBannerSlot: (id: number) =>
    catalogRequest<BannerSlotResponse>(`/admin/banner-slots/${id}`),

  createBannerSlot: (body: CreateBannerSlotRequest) =>
    catalogRequest<BannerSlotResponse>('/admin/banner-slots', { method: 'POST', body }),

  updateBannerSlot: (id: number, body: UpdateBannerSlotRequest) =>
    catalogRequest<BannerSlotResponse>(`/admin/banner-slots/${id}`, { method: 'PUT', body }),

  deleteBannerSlot: (id: number) =>
    catalogRequest<void>(`/admin/banner-slots/${id}`, { method: 'DELETE' }),

  assignBannerToSlot: (slotId: number, body: AssignBannerToSlotRequest) =>
    catalogRequest<BannerSlotResponse>(`/admin/banner-slots/${slotId}/banners`, { method: 'POST', body }),

  reorderSlotBanners: (slotId: number, body: ReorderBannerSlotRequest) =>
    catalogRequest<BannerSlotResponse>(`/admin/banner-slots/${slotId}/banners/reorder`, { method: 'PUT', body }),

  removeBannerFromSlot: (slotId: number, bannerId: number) =>
    catalogRequest<void>(`/admin/banner-slots/${slotId}/banners/${bannerId}`, { method: 'DELETE' }),

  // ── Product Showcases ────────────────────────────────────────────────────────

  listShowcaseGroups: () =>
    catalogArray<ShowcaseGroupResponse>('/admin/product-showcases'),

  listShowcaseTypes: () =>
    catalogArray<ShowcaseTypeOption>('/admin/product-showcases/types'),

  getShowcaseGroup: (id: number) =>
    catalogRequest<ShowcaseGroupResponse>(`/admin/product-showcases/${id}`),

  createShowcaseGroup: (body: CreateShowcaseGroupRequest) =>
    catalogRequest<ShowcaseGroupResponse>('/admin/product-showcases', { method: 'POST', body }),

  updateShowcaseGroup: (id: number, body: UpdateShowcaseGroupRequest) =>
    catalogRequest<ShowcaseGroupResponse>(`/admin/product-showcases/${id}`, { method: 'PUT', body }),

  deleteShowcaseGroup: (id: number) =>
    catalogRequest<void>(`/admin/product-showcases/${id}`, { method: 'DELETE' }),

  addShowcaseItems: (id: number, body: AddShowcaseItemsRequest) =>
    catalogRequest<ShowcaseGroupResponse>(`/admin/product-showcases/${id}/items`, { method: 'POST', body }),

  removeShowcaseItem: (id: number, productId: number) =>
    catalogRequest<void>(`/admin/product-showcases/${id}/items/${productId}`, { method: 'DELETE' }),

  reorderShowcaseItems: (id: number, body: ReorderShowcaseItemsRequest) =>
    catalogRequest<ShowcaseGroupResponse>(`/admin/product-showcases/${id}/items/reorder`, { method: 'PUT', body }),

  // ── Category Showcases ─────────────────────────────────────────────────────

  listCategoryShowcaseGroups: () =>
    catalogArray<CategoryShowcaseGroupResponse>('/admin/category-showcases'),

  listCategoryShowcaseTypes: () =>
    catalogArray<CategoryShowcaseTypeOption>('/admin/category-showcases/types'),

  getCategoryShowcaseGroup: (id: number) =>
    catalogRequest<CategoryShowcaseGroupResponse>(`/admin/category-showcases/${id}`),

  createCategoryShowcaseGroup: (body: CreateCategoryShowcaseGroupRequest) =>
    catalogRequest<CategoryShowcaseGroupResponse>('/admin/category-showcases', { method: 'POST', body }),

  updateCategoryShowcaseGroup: (id: number, body: UpdateCategoryShowcaseGroupRequest) =>
    catalogRequest<CategoryShowcaseGroupResponse>(`/admin/category-showcases/${id}`, { method: 'PUT', body }),

  deleteCategoryShowcaseGroup: (id: number) =>
    catalogRequest<void>(`/admin/category-showcases/${id}`, { method: 'DELETE' }),

  addCategoryShowcaseItems: (id: number, body: AddCategoryShowcaseItemsRequest) =>
    catalogRequest<CategoryShowcaseGroupResponse>(`/admin/category-showcases/${id}/items`, { method: 'POST', body }),

  removeCategoryShowcaseItem: (id: number, categoryId: number) =>
    catalogRequest<void>(`/admin/category-showcases/${id}/items/${categoryId}`, { method: 'DELETE' }),

  reorderCategoryShowcaseItems: (id: number, body: ReorderCategoryShowcaseItemsRequest) =>
    catalogRequest<CategoryShowcaseGroupResponse>(`/admin/category-showcases/${id}/items/reorder`, { method: 'PUT', body }),

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
    opts: { scope: 'category' | 'product' | 'banner'; slug: string; index?: number }
  ): Promise<string> => {
    if (!catalogConfigured()) {
      throw new CatalogApiError(0, 'Catalog API is not available.');
    }

    const params = new URLSearchParams({ scope: opts.scope, slug: opts.slug.trim() });
    if (opts.index != null) params.set('index', String(opts.index));

    const form = new FormData();
    form.append('image', file);

    let res: Response;
    try {
      res = await fetch(inventoryApiUrl(`/images/upload?${params}`), {
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
