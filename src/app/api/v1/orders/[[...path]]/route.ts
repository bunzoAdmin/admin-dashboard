import { ordersProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = ordersProxy.GET;
export const POST = ordersProxy.POST;
export const PUT = ordersProxy.PUT;
export const PATCH = ordersProxy.PATCH;
export const DELETE = ordersProxy.DELETE;
