import { adminCatalogProductsProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = adminCatalogProductsProxy.GET;
export const POST = adminCatalogProductsProxy.POST;
export const PUT = adminCatalogProductsProxy.PUT;
export const PATCH = adminCatalogProductsProxy.PATCH;
export const DELETE = adminCatalogProductsProxy.DELETE;
