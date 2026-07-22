import { NextRequest, NextResponse } from 'next/server';
import {
  isOrderServicePath,
  ORDER_SERVICE_PROXY_TARGET,
  PRODUCT_SERVICE_PROXY_TARGET,
  SEARCH_SERVICE_PROXY_TARGET
} from './inventoryApiConfig';

export const runtime = 'nodejs';

const FORWARD_REQUEST_HEADERS = [
  'authorization',
  'idempotency-key',
  'accept',
  'x-internal-admin',
  'actor-id',
  'customer-id'
];

function buildTargetUrl(basePath: string, pathSegments: string[] | undefined, search: string, targetOverride?: string): string {
  const host = targetOverride
    ?? (isOrderServicePath(basePath) ? ORDER_SERVICE_PROXY_TARGET : PRODUCT_SERVICE_PROXY_TARGET);
  const suffix = pathSegments?.length ? `/${pathSegments.join('/')}` : '';
  return `${host}${basePath}${suffix}${search}`;
}

function forwardHeaders(req: NextRequest, opts?: { injectSearchAuth?: boolean }): Headers {
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  for (const name of FORWARD_REQUEST_HEADERS) {
    // Search-service uses its own HTTP Basic creds — never forward the dashboard Bearer token.
    if (opts?.injectSearchAuth && name === 'authorization') continue;
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (opts?.injectSearchAuth) {
    const creds = process.env.SEARCH_SERVICE_BASIC_AUTH;
    if (creds) {
      headers.set('Authorization', creds.startsWith('Basic ') ? creds : `Basic ${creds}`);
    }
  }
  return headers;
}

async function proxy(req: NextRequest, basePath: string, pathSegments?: string[], targetOverride?: string, injectSearchAuth = false): Promise<NextResponse> {
  const target = buildTargetUrl(basePath, pathSegments, req.nextUrl.search, targetOverride);

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.arrayBuffer();
    } catch {
      return NextResponse.json({ message: 'Failed to read request body' }, { status: 400 });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders(req, { injectSearchAuth }),
      body: body && body.byteLength > 0 ? body : undefined
    });
  } catch {
    return NextResponse.json({ message: 'Could not reach backend service' }, { status: 502 });
  }

  // 204 / 205 / 304 must not carry a body — NextResponse throws if you pass one.
  const noBodyStatuses = [204, 205, 304];
  if (noBodyStatuses.includes(upstream.status)) {
    return new NextResponse(null, { status: upstream.status });
  }

  const responseText = await upstream.text();
  return new NextResponse(responseText, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
    }
  });
}

type RouteContext = { params: Promise<{ path?: string[] }> };

function handlers(basePath: string, targetOverride?: string, injectSearchAuth = false) {
  async function run(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxy(req, basePath, path, targetOverride, injectSearchAuth);
  }
  return {
    GET: run,
    POST: run,
    PUT: run,
    PATCH: run,
    DELETE: run
  };
}

export const catalogProxy = handlers('/api/v1/catalog');
export const inventoryProxy = handlers('/api/v1/inventory');
export const storesProxy = handlers('/api/v1/admin/stores');
export const pickerProxy = handlers('/api/v1/admin/picker');
export const imagesProxy = handlers('/api/v1/images');
export const adminBannersProxy = handlers('/api/v1/admin/banners');
export const adminBannerSlotsProxy = handlers('/api/v1/admin/banner-slots');
export const adminProductShowcasesProxy = handlers('/api/v1/admin/product-showcases');
export const adminCategoryShowcasesProxy = handlers('/api/v1/admin/category-showcases');
export const adminCatalogProductsProxy = handlers('/api/v1/admin/catalog/products');

// Order-service customer order routes (cancel, status, etc.)
export const ordersProxy = handlers('/api/v1/orders');

// Order-service admin routes
export const adminOrdersProxy = handlers('/api/v1/admin/orders');
export const adminCouponsProxy = handlers('/api/v1/admin/coupons');
export const adminRefundsProxy = handlers('/api/v1/admin/refunds');

// Product-service admin inventory routes (discrepancies, stock-movements)
export const adminInventoryProxy = handlers('/api/v1/admin/inventory');

// Search-service admin routes (base path maps directly to /admin/search on search-service)
export const searchAdminProxy = handlers('/admin/search', SEARCH_SERVICE_PROXY_TARGET, true);
