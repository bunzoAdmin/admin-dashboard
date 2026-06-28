import { storesProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = storesProxy.GET;
export const POST = storesProxy.POST;
export const PUT = storesProxy.PUT;
export const PATCH = storesProxy.PATCH;
export const DELETE = storesProxy.DELETE;
