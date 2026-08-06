import { adminZraProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = adminZraProxy.GET;
export const POST = adminZraProxy.POST;
export const PUT = adminZraProxy.PUT;
export const PATCH = adminZraProxy.PATCH;
export const DELETE = adminZraProxy.DELETE;
