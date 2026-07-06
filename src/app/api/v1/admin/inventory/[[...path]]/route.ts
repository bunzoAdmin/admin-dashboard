import { adminInventoryProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = adminInventoryProxy.GET;
export const POST = adminInventoryProxy.POST;
export const PUT = adminInventoryProxy.PUT;
export const PATCH = adminInventoryProxy.PATCH;
export const DELETE = adminInventoryProxy.DELETE;
