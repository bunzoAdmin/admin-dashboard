import { catalogProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = catalogProxy.GET;
export const POST = catalogProxy.POST;
export const PUT = catalogProxy.PUT;
export const PATCH = catalogProxy.PATCH;
export const DELETE = catalogProxy.DELETE;
