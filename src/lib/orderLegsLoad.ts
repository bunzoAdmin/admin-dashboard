import { api } from './api';
import { orderAdminApi } from './orderAdminApi';
import { pickerApi } from './pickerApi';
import { buildOrderLegRow } from './orderLegs';
import type { OrderEventLike, OrderLegRow, PickTaskLike } from './orderLegs';
import type { AdminOrderListItem, PagedAdminOrderResponse } from './orderAdminTypes';
import type { TripByOrder } from './types';

export const LEG_DAY_CAP = 500;
export const LEG_POOL = 8;
const LIST_PAGE_SIZE = 100;
const TRIP_CHUNK = 100;

export type DayLegClients = {
  listOrders: (params: {
    storeId: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    size?: number;
  }) => Promise<PagedAdminOrderResponse>;
  getOrderEvents: (orderNumber: string) => Promise<OrderEventLike[]>;
  getTask: (taskId: number) => Promise<PickTaskLike | null>;
  getTaskForOrder: (orderNumber: string) => Promise<PickTaskLike | null>;
  getTripsByOrders: (ids: string[]) => Promise<{ trips: TripByOrder[] }>;
};

function defaultClients(): DayLegClients {
  return {
    listOrders: (params) => orderAdminApi.listOrders(params),
    getOrderEvents: (orderNumber) => orderAdminApi.getOrderEvents(orderNumber),
    getTask: (taskId) => pickerApi.getTask(taskId),
    getTaskForOrder: (orderNumber) => pickerApi.getTaskForOrder(orderNumber),
    getTripsByOrders: (ids) => api.getTripsByOrders(ids)
  };
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    })
  );
  return results;
}

async function listAllOrdersForRange(
  storeId: number,
  dateFromIso: string,
  dateToIso: string,
  listOrders: DayLegClients['listOrders']
): Promise<{ orders: AdminOrderListItem[]; total: number; truncated: boolean }> {
  const orders: AdminOrderListItem[] = [];
  let page = 0;
  let total = 0;

  while (orders.length < LEG_DAY_CAP) {
    const resp = await listOrders({
      storeId,
      dateFrom: dateFromIso,
      dateTo: dateToIso,
      page,
      size: LIST_PAGE_SIZE
    });
    total = resp.meta.totalElements;
    if (resp.content.length === 0) break;
    const room = LEG_DAY_CAP - orders.length;
    orders.push(...resp.content.slice(0, room));
    if (orders.length >= LEG_DAY_CAP) break;
    if (resp.meta.last) break;
    page += 1;
  }

  return { orders, total, truncated: total > orders.length };
}

async function loadEvents(orderNumber: string, deps: DayLegClients): Promise<OrderEventLike[]> {
  try {
    return await deps.getOrderEvents(orderNumber);
  } catch {
    return [];
  }
}

async function loadPick(order: AdminOrderListItem, deps: DayLegClients): Promise<PickTaskLike | null> {
  try {
    if (order.pickTaskId != null) {
      return (await deps.getTask(order.pickTaskId)) ?? null;
    }
    return (await deps.getTaskForOrder(order.orderNumber)) ?? null;
  } catch {
    return null;
  }
}

async function loadTrips(ids: string[], getTripsByOrders: DayLegClients['getTripsByOrders']): Promise<Map<string, TripByOrder>> {
  try {
    const trips: TripByOrder[] = [];
    for (let i = 0; i < ids.length; i += TRIP_CHUNK) {
      const chunk = ids.slice(i, i + TRIP_CHUNK);
      const res = await getTripsByOrders(chunk);
      trips.push(...res.trips);
    }
    return new Map(trips.map((trip) => [trip.order_id, trip]));
  } catch {
    return new Map();
  }
}

export async function loadDayLegRows(
  storeId: number,
  dateFromIso: string,
  dateToIso: string,
  nowMs: number,
  deps?: DayLegClients
): Promise<{ rows: OrderLegRow[]; truncated: boolean; total: number }> {
  const clients = deps ?? defaultClients();
  const { orders, total, truncated } = await listAllOrdersForRange(
    storeId,
    dateFromIso,
    dateToIso,
    clients.listOrders
  );

  const hydrated = await mapPool(orders, LEG_POOL, async (order) => {
    const [events, pick] = await Promise.all([
      loadEvents(order.orderNumber, clients),
      loadPick(order, clients)
    ]);
    return { order, events, pick };
  });

  const tripByOrder = await loadTrips(
    orders.map((order) => order.orderNumber),
    clients.getTripsByOrders
  );

  const rows = hydrated.map(({ order, events, pick }) =>
    buildOrderLegRow({
      order,
      events,
      pick,
      trip: tripByOrder.get(order.orderNumber) ?? null,
      nowMs
    })
  );

  rows.sort((a, b) => {
    const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (diff !== 0) return diff;
    return b.orderNumber.localeCompare(a.orderNumber);
  });

  return { rows, truncated, total };
}
