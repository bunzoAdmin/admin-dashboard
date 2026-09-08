import { adminPromotionsProxy } from '@/lib/backendProxy';

export const runtime = 'nodejs';

export const GET = adminPromotionsProxy.GET;
export const POST = adminPromotionsProxy.POST;
export const PUT = adminPromotionsProxy.PUT;
export const PATCH = adminPromotionsProxy.PATCH;
export const DELETE = adminPromotionsProxy.DELETE;
