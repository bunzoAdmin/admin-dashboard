'use client';

import { getStoredToken } from './store';
import { inventoryApiUrl } from './inventoryApiConfig';
import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';
import type {
  CancelOrderRequest,
  OrderEventResponse,
  OrderPipelineResponse,
  OrderResponse,
  PagedAdminOrderResponse,
  PagedOrderResponse,
  UpdateOrderStatusRequest
} from './orderAdminTypes';
import type { OrderAnalyticsPeriod, OrderAnalyticsResponse } from './orderAnalyticsTypes';

export class OrderAdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'OrderAdminApiError';
    this.status = status;
  }
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; extraHeaders?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.extraHeaders };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(inventoryApiUrl(path), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new OrderAdminApiError(0, 'Could not reach the order service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new OrderAdminApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Order request failed.')
    );
  }

  return data as T;
}

export const orderAdminApi = {
  listOrders: (params: {
    storeId: number;
    status?: string;
    paymentStatus?: string;
    customerPhone?: string;
    orderNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
  }) => {
    const q = new URLSearchParams({ storeId: String(params.storeId) });
    if (params.status) q.set('status', params.status);
    if (params.paymentStatus) q.set('paymentStatus', params.paymentStatus);
    if (params.customerPhone) q.set('customerPhone', params.customerPhone.trim());
    if (params.orderNumber) q.set('orderNumber', params.orderNumber.trim());
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 20));
    return req<PagedAdminOrderResponse>(`/admin/orders?${q}`);
  },

  getOrder: (orderNumber: string) =>
    req<OrderResponse>(`/admin/orders/${encodeURIComponent(orderNumber)}`),

  getPipeline: (storeId: number) =>
    req<OrderPipelineResponse>(`/admin/orders/pipeline?storeId=${storeId}`),

  getAnalytics: (
    storeId: number,
    opts: {
      period: OrderAnalyticsPeriod;
      from: string;
      toExclusive: string;
      label?: string;
      calendarFrom?: string;
      calendarTo?: string;
      utcOffsetMinutes?: number;
      slaMinutes?: number;
    }
  ) => {
    const q = new URLSearchParams({
      storeId: String(storeId),
      period: opts.period,
      from: opts.from,
      toExclusive: opts.toExclusive
    });
    if (opts.label) q.set('label', opts.label);
    if (opts.calendarFrom) q.set('calendarFrom', opts.calendarFrom);
    if (opts.calendarTo) q.set('calendarTo', opts.calendarTo);
    if (opts.utcOffsetMinutes != null) q.set('utcOffsetMinutes', String(opts.utcOffsetMinutes));
    if (opts.slaMinutes != null) q.set('slaMinutes', String(opts.slaMinutes));
    return req<OrderAnalyticsResponse>(`/admin/orders/metrics/analytics?${q}`);
  },

  getOrderEvents: (orderNumber: string) =>
    req<OrderEventResponse[]>(`/admin/orders/${encodeURIComponent(orderNumber)}/events`),

  cancelOrder: (orderNumber: string, body: CancelOrderRequest, actorId = 'ADMIN') =>
    req<OrderResponse>(`/api/v1/orders/${encodeURIComponent(orderNumber)}/cancel`, {
      method: 'POST',
      body,
      extraHeaders: {
        'X-Internal-Admin': 'true',
        'Actor-Id': actorId,
        'Customer-Id': 'ADMIN'
      }
    }),

  updateStatus: (orderNumber: string, body: UpdateOrderStatusRequest, actorId = 'ADMIN') =>
    req<OrderResponse>(`/api/v1/orders/${encodeURIComponent(orderNumber)}/status`, {
      method: 'POST',
      body,
      extraHeaders: { 'Actor-Id': actorId }
    })
};
