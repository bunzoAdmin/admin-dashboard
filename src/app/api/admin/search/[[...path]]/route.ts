import { searchAdminProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = searchAdminProxy.GET;
export const POST = searchAdminProxy.POST;
export const PUT = searchAdminProxy.PUT;
export const PATCH = searchAdminProxy.PATCH;
export const DELETE = searchAdminProxy.DELETE;
