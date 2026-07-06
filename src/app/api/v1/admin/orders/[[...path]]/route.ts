import { adminOrdersProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = adminOrdersProxy.GET;
export const POST = adminOrdersProxy.POST;
export const PUT = adminOrdersProxy.PUT;
export const PATCH = adminOrdersProxy.PATCH;
export const DELETE = adminOrdersProxy.DELETE;
