import { inventoryProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = inventoryProxy.GET;
export const POST = inventoryProxy.POST;
export const PUT = inventoryProxy.PUT;
export const PATCH = inventoryProxy.PATCH;
export const DELETE = inventoryProxy.DELETE;
