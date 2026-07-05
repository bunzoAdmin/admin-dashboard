import { adminBannersProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = adminBannersProxy.GET;
export const POST = adminBannersProxy.POST;
export const PUT = adminBannersProxy.PUT;
export const PATCH = adminBannersProxy.PATCH;
export const DELETE = adminBannersProxy.DELETE;
