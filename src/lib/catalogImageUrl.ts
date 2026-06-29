/**
 * Resolve a catalog R2 key (or absolute URL) to a browser-displayable image URL.
 * Set NEXT_PUBLIC_CATALOG_IMAGE_BASE_URL to your CDN or MinIO public bucket prefix, e.g.:
 *   http://localhost:9000/product-images
 *   https://cdn.example.com/cdn-cgi/image/w=400,h=400,fit=cover,f=auto,q=80
 */
const CATALOG_IMAGE_BASE = process.env.NEXT_PUBLIC_CATALOG_IMAGE_BASE_URL?.replace(/\/$/, '') ?? '';

export function resolveCatalogImageUrl(r2Key: string | null | undefined): string | null {
  if (!r2Key?.trim()) return null;
  const trimmed = r2Key.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (!CATALOG_IMAGE_BASE) return null;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${CATALOG_IMAGE_BASE}${path}`;
}

export function catalogImageBaseConfigured(): boolean {
  return CATALOG_IMAGE_BASE.length > 0;
}
