/**
 * Inventory microservice URLs for the admin dashboard.
 *
 * Browser: calls same-origin `/api/v1/...` route handlers by default (no public
 * env required on Vercel). Optional NEXT_PUBLIC_INVENTORY_API_BASE_URL override.
 *
 * Server (route handlers): PRODUCT_SERVICE_PROXY_TARGET + ORDER_SERVICE_PROXY_TARGET
 * must point at real backends including the service prefix.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Server → product-service (catalog, inventory, images, stores). */
export const PRODUCT_SERVICE_PROXY_TARGET = stripTrailingSlash(
  process.env.PRODUCT_SERVICE_PROXY_TARGET ??
    process.env.CATALOG_PROXY_TARGET ??
    'http://localhost:8081/product-service'
);

/** Server → order-service (picker admin, order admin, coupon admin, refund admin). */
export const ORDER_SERVICE_PROXY_TARGET = stripTrailingSlash(
  process.env.ORDER_SERVICE_PROXY_TARGET ??
    process.env.ORDER_PROXY_TARGET ??
    'http://localhost:8082/order-service'
);

/** Server → search-service (synonyms, settings, index). */
export const SEARCH_SERVICE_PROXY_TARGET = stripTrailingSlash(
  process.env.SEARCH_SERVICE_PROXY_TARGET ?? 'http://localhost:8083/search-service'
);

/**
 * Browser URL for inventory microservice APIs.
 * Defaults to same-origin relative paths so HTTPS dashboards never call http:// backends.
 */
export function inventoryApiUrl(path: string): string {
  const normalized =
    path.startsWith('/api/v1') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const base = process.env.NEXT_PUBLIC_INVENTORY_API_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}${normalized}` : normalized;
}

export function inventoryApiConfigured(): boolean {
  return true;
}

/** Paths served by order-service (customer order actions, picker admin, order admin, etc.). */
export function isOrderServicePath(apiPath: string): boolean {
  return (
    apiPath.startsWith('/api/v1/orders') ||
    apiPath.startsWith('/api/v1/admin/picker') ||
    apiPath.startsWith('/api/v1/admin/orders') ||
    apiPath.startsWith('/api/v1/admin/coupons') ||
    apiPath.startsWith('/api/v1/admin/refunds')
  );
}
