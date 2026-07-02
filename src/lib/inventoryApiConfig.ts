/**
 * Inventory microservice URLs for the admin dashboard.
 *
 * Browser (client components): set NEXT_PUBLIC_INVENTORY_API_BASE_URL to this
 * Next.js app (same origin). Route handlers under /api/v1/* proxy upstream.
 *
 * Server (route handlers): set PRODUCT_SERVICE_PROXY_TARGET and
 * ORDER_SERVICE_PROXY_TARGET to the real backends (include service prefix).
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Browser → Next.js `/api/v1/...` route handlers. */
export const INVENTORY_API_BASE_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_INVENTORY_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ??
    process.env.NEXT_PUBLIC_ORDER_API_BASE_URL ??
    'http://localhost:3100'
);

/** Server → product-service (catalog, inventory, images, stores). */
export const PRODUCT_SERVICE_PROXY_TARGET = stripTrailingSlash(
  process.env.PRODUCT_SERVICE_PROXY_TARGET ??
    process.env.CATALOG_PROXY_TARGET ??
    'http://localhost:8081/product-service'
);

/** Server → order-service (picker admin). */
export const ORDER_SERVICE_PROXY_TARGET = stripTrailingSlash(
  process.env.ORDER_SERVICE_PROXY_TARGET ??
    process.env.ORDER_PROXY_TARGET ??
    'http://localhost:8082/order-service'
);

export function inventoryApiConfigured(): boolean {
  return INVENTORY_API_BASE_URL.length > 0;
}

/** Paths served by order-service (picker admin). */
export function isOrderServicePath(apiPath: string): boolean {
  return apiPath.startsWith('/api/v1/admin/picker');
}
