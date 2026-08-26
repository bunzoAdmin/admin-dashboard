import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LEG_DAY_CAP, LEG_POOL, loadDayLegRows, mapPool } from './orderLegsLoad';
import { api } from './api';
import type { AdminOrderListItem, PagedAdminOrderResponse } from './orderAdminTypes';
import type { OrderEventResponse } from './orderAdminTypes';
import type { DayLegClients } from './orderLegsLoad';
import type { TripByOrder } from './types';

const NOW_MS = Date.parse('2026-08-26T10:00:00.000Z');
const DATE_FROM = '2026-08-25T22:00:00.000Z';
const DATE_TO = '2026-08-26T22:00:00.000Z';

function stubOrder(overrides: Partial<AdminOrderListItem> & { orderNumber: string }): AdminOrderListItem {
  return {
    orderNumber: overrides.orderNumber,
    customerId: 'c1',
    storeId: 1,
    status: 'CANCELLED',
    paymentMethod: 'COD',
    paymentStatus: 'COD_PENDING',
    itemsTotal: 10,
    deliveryFee: 0,
    grandTotal: 10,
    currency: 'ZMW',
    appliedCouponCodes: [],
    discountBreakdown: [],
    items: [{ sku: 'A', productName: 'Apple', orderedQuantity: 2, unitPrice: 5, subTotal: 10 }],
    createdAt: '2026-08-26T08:00:00.000Z',
    updatedAt: '2026-08-26T08:00:00.000Z',
    ...overrides
  };
}

function paged(
  content: AdminOrderListItem[],
  totalElements: number,
  page: number,
  last: boolean
): PagedAdminOrderResponse {
  return {
    content,
    meta: {
      page,
      size: 100,
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / 100)),
      first: page === 0,
      last
    }
  };
}

function manyOrders(n: number, start = 0): AdminOrderListItem[] {
  return Array.from({ length: n }, (_, i) =>
    stubOrder({
      orderNumber: `ORD-${String(start + i).padStart(4, '0')}`,
      createdAt: new Date(Date.parse('2026-08-26T08:00:00.000Z') + i * 1000).toISOString()
    })
  );
}

function makeClients(opts: {
  list: DayLegClients['listOrders'];
  events?: DayLegClients['getOrderEvents'];
  getTask?: DayLegClients['getTask'];
  getTaskForOrder?: DayLegClients['getTaskForOrder'];
  getTripsByOrders?: DayLegClients['getTripsByOrders'];
}): DayLegClients & {
  eventCalls: string[];
  getTaskCalls: number[];
  getTaskForOrderCalls: string[];
  tripCalls: string[][];
  listCalls: Parameters<DayLegClients['listOrders']>[0][];
} {
  const eventCalls: string[] = [];
  const getTaskCalls: number[] = [];
  const getTaskForOrderCalls: string[] = [];
  const tripCalls: string[][] = [];
  const listCalls: Parameters<DayLegClients['listOrders']>[0][] = [];

  return {
    eventCalls,
    getTaskCalls,
    getTaskForOrderCalls,
    tripCalls,
    listCalls,
    listOrders: async (params) => {
      listCalls.push(params);
      return opts.list(params);
    },
    getOrderEvents: async (orderNumber) => {
      eventCalls.push(orderNumber);
      if (opts.events) return opts.events(orderNumber);
      return [];
    },
    getTask: async (taskId) => {
      getTaskCalls.push(taskId);
      if (opts.getTask) return opts.getTask(taskId);
      return null;
    },
    getTaskForOrder: async (orderNumber) => {
      getTaskForOrderCalls.push(orderNumber);
      if (opts.getTaskForOrder) return opts.getTaskForOrder(orderNumber);
      return null;
    },
    getTripsByOrders: async (ids) => {
      tripCalls.push(ids);
      if (opts.getTripsByOrders) return opts.getTripsByOrders(ids);
      return { trips: [] };
    }
  };
}

describe('constants', () => {
  it('caps the day at 500 and hydrates with a pool of 8', () => {
    assert.equal(LEG_DAY_CAP, 500);
    assert.equal(LEG_POOL, 8);
  });
});

describe('mapPool', () => {
  it('preserves order and never exceeds concurrency', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    const result = await mapPool(items, 3, async (item) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((resolve) => setTimeout(resolve, 15));
      inflight -= 1;
      return item * 2;
    });

    assert.deepEqual(
      result,
      [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    );
    assert.ok(maxInflight <= 3, `max in-flight was ${maxInflight}`);
    assert.equal(maxInflight, 3);
  });
});

describe('loadDayLegRows', () => {
  it('hydrates two orders via events, pick, and one trip join', async () => {
    const older = stubOrder({
      orderNumber: 'ORD-OLD',
      status: 'DELIVERED',
      createdAt: '2026-08-26T08:00:00.000Z',
      items: [{ sku: 'A', productName: 'Apple', orderedQuantity: 3, unitPrice: 1, subTotal: 3 }]
    });
    const newer = stubOrder({
      orderNumber: 'ORD-NEW',
      status: 'DELIVERED',
      createdAt: '2026-08-26T09:00:00.000Z',
      items: [{ sku: 'B', productName: 'Banana', orderedQuantity: 7, unitPrice: 1, subTotal: 7 }]
    });

    const eventsByOrder: Record<string, OrderEventResponse[]> = {
      'ORD-OLD': [
        { eventType: 'STATUS', toStatus: 'CONFIRMED', occurredAt: '2026-08-26T08:00:30.000Z' },
        { eventType: 'STATUS', toStatus: 'OUT_FOR_DELIVERY', occurredAt: '2026-08-26T08:03:30.000Z' },
        { eventType: 'STATUS', toStatus: 'DELIVERED', occurredAt: '2026-08-26T08:07:30.000Z' }
      ],
      'ORD-NEW': [
        { eventType: 'STATUS', toStatus: 'CONFIRMED', occurredAt: '2026-08-26T09:00:30.000Z' },
        { eventType: 'STATUS', toStatus: 'OUT_FOR_DELIVERY', occurredAt: '2026-08-26T09:03:30.000Z' },
        { eventType: 'STATUS', toStatus: 'DELIVERED', occurredAt: '2026-08-26T09:07:30.000Z' }
      ]
    };
    const pickByOrder: Record<string, { startedAt: string; completedAt: string }> = {
      'ORD-OLD': { startedAt: '2026-08-26T08:01:30.000Z', completedAt: '2026-08-26T08:02:30.000Z' },
      'ORD-NEW': { startedAt: '2026-08-26T09:01:30.000Z', completedAt: '2026-08-26T09:02:30.000Z' }
    };
    const trips: TripByOrder[] = [
      {
        order_id: 'ORD-OLD',
        distance_km: 1.5,
        reached_at: '2026-08-26T08:05:30.000Z',
        trip_status: 'completed'
      },
      {
        order_id: 'ORD-NEW',
        distance_km: 2.4,
        reached_at: '2026-08-26T09:05:30.000Z',
        trip_status: 'completed'
      }
    ];

    const clients = makeClients({
      list: async () => paged([older, newer], 2, 0, true),
      events: async (orderNumber) => eventsByOrder[orderNumber] ?? [],
      getTaskForOrder: async (orderNumber) => pickByOrder[orderNumber] ?? null,
      getTripsByOrders: async () => ({ trips })
    });

    const result = await loadDayLegRows(7, DATE_FROM, DATE_TO, NOW_MS, clients);

    assert.equal(clients.listCalls.length, 1);
    assert.deepEqual(clients.listCalls[0], {
      storeId: 7,
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
      page: 0,
      size: 100
    });
    assert.deepEqual(clients.eventCalls.sort(), ['ORD-NEW', 'ORD-OLD']);
    assert.deepEqual(clients.getTaskForOrderCalls.sort(), ['ORD-NEW', 'ORD-OLD']);
    assert.deepEqual(clients.getTaskCalls, []);
    assert.equal(clients.tripCalls.length, 1);
    assert.deepEqual(clients.tripCalls[0].slice().sort(), ['ORD-NEW', 'ORD-OLD']);

    assert.equal(result.total, 2);
    assert.equal(result.truncated, false);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(
      result.rows.map((row) => row.orderNumber),
      ['ORD-NEW', 'ORD-OLD']
    );

    const newRow = result.rows[0];
    assert.equal(newRow.units, 7);
    assert.equal(newRow.distanceKm, 2.4);
    assert.equal(newRow.itemPredictedMinutes, 2);
    assert.equal(newRow.lastMilePredictedMinutes, 4.8);
    assert.deepEqual(
      newRow.legs.map((leg) => [leg.id, leg.actualSeconds]),
      [
        ['created_to_confirmed', 30],
        ['confirmed_to_pick_start', 60],
        ['pick_start_to_pick_end', 60],
        ['pick_end_to_ofd', 60],
        ['ofd_to_reached', 120],
        ['reached_to_delivered', 120]
      ]
    );

    const oldRow = result.rows[1];
    assert.equal(oldRow.units, 3);
    assert.equal(oldRow.distanceKm, 1.5);
    assert.equal(oldRow.actualE2eSeconds, 450);
  });

  it('stops at 500 orders and reports truncated when total is 501', async () => {
    const all = manyOrders(501);
    const clients = makeClients({
      list: async (params) => {
        const page = params.page ?? 0;
        const size = params.size ?? 100;
        const start = page * size;
        const content = all.slice(start, start + size);
        return paged(content, 501, page, start + content.length >= 501);
      }
    });

    const result = await loadDayLegRows(1, DATE_FROM, DATE_TO, NOW_MS, clients);

    assert.equal(clients.listCalls.length, 5);
    assert.deepEqual(
      clients.listCalls.map((call) => call.page),
      [0, 1, 2, 3, 4]
    );
    assert.ok(clients.listCalls.every((call) => call.size === 100));
    assert.equal(result.rows.length, LEG_DAY_CAP);
    assert.equal(result.truncated, true);
    assert.equal(result.total, 501);
    assert.equal(clients.eventCalls.length, 500);
  });

  it('uses getTask when pickTaskId is set and treats pick failures as null', async () => {
    const withId = stubOrder({
      orderNumber: 'ORD-TASK',
      pickTaskId: 42,
      status: 'CANCELLED'
    });
    const alsoWithId = stubOrder({
      orderNumber: 'ORD-NULL',
      pickTaskId: 99,
      status: 'CANCELLED'
    });

    const clients = makeClients({
      list: async () => paged([withId, alsoWithId], 2, 0, true),
      getTask: async (taskId) => {
        if (taskId === 42) throw new Error('pick down');
        return null;
      },
      getTaskForOrder: async () => {
        throw new Error('should not call by-order');
      }
    });

    const result = await loadDayLegRows(1, DATE_FROM, DATE_TO, NOW_MS, clients);

    assert.deepEqual(clients.getTaskCalls.slice().sort(), [42, 99]);
    assert.deepEqual(clients.getTaskForOrderCalls, []);
    assert.equal(result.rows.length, 2);
    for (const row of result.rows) {
      const pickLeg = row.legs.find((leg) => leg.id === 'pick_start_to_pick_end');
      assert.equal(pickLeg?.actualSeconds, null);
    }
  });

  it('keeps an order when events fail and does not throw', async () => {
    const ok = stubOrder({ orderNumber: 'ORD-OK', status: 'CANCELLED' });
    const bad = stubOrder({ orderNumber: 'ORD-BAD', status: 'CANCELLED' });

    const clients = makeClients({
      list: async () => paged([ok, bad], 2, 0, true),
      events: async (orderNumber) => {
        if (orderNumber === 'ORD-BAD') throw new Error('events down');
        return [{ eventType: 'STATUS', toStatus: 'CONFIRMED', occurredAt: '2026-08-26T08:00:30.000Z' }];
      }
    });

    const result = await loadDayLegRows(1, DATE_FROM, DATE_TO, NOW_MS, clients);

    assert.equal(result.rows.length, 2);
    const badRow = result.rows.find((row) => row.orderNumber === 'ORD-BAD');
    const okRow = result.rows.find((row) => row.orderNumber === 'ORD-OK');
    assert.ok(badRow);
    assert.ok(okRow);
    assert.equal(
      badRow!.legs.find((leg) => leg.id === 'created_to_confirmed')?.actualSeconds,
      null
    );
    assert.equal(
      okRow!.legs.find((leg) => leg.id === 'created_to_confirmed')?.actualSeconds,
      30
    );
  });

  it('chunks getTripsByOrders into groups of 100', async () => {
    const orders = manyOrders(101);
    const clients = makeClients({
      list: async () => paged(orders, 101, 0, true)
    });

    const result = await loadDayLegRows(1, DATE_FROM, DATE_TO, NOW_MS, clients);

    assert.equal(result.rows.length, 101);
    assert.equal(clients.tripCalls.length, 2);
    assert.equal(clients.tripCalls[0].length, 100);
    assert.equal(clients.tripCalls[1].length, 1);
    assert.deepEqual(
      [...clients.tripCalls[0], ...clients.tripCalls[1]],
      orders.map((order) => order.orderNumber)
    );
  });
});

describe('api.getTripsByOrders', () => {
  it('returns empty trips without fetch when ids is empty', async () => {
    const orig = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response('{}');
    }) as typeof fetch;
    try {
      const result = await api.getTripsByOrders([]);
      assert.deepEqual(result, { trips: [] });
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
