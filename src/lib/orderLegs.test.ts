import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  itemPredictedMinutes,
  lastMilePredictedMinutes,
  predictedE2eMinutes,
  formatDurationMmSs,
  legTone,
  e2eTone,
  LEG_IDS,
  LEG_THRESHOLDS,
  buildOrderLegRow
} from './orderLegs';
import type { OrderEventLike, OrderLike, PickTaskLike, TripLike } from './orderLegs';

const NOW_MS = Date.parse('2026-08-26T10:00:00.000Z');

const emptyPred = {
  itemMinutes: 0,
  lastMileMinutes: null,
  predictedE2eMinutes: null
};

describe('itemPredictedMinutes', () => {
  it('is 0 when units is 0', () => {
    assert.equal(itemPredictedMinutes(0), 0);
  });

  it('is ceil(n/5) and at least 1 when units >= 1', () => {
    assert.equal(itemPredictedMinutes(1), 1);
    assert.equal(itemPredictedMinutes(5), 1);
    assert.equal(itemPredictedMinutes(6), 2);
  });
});

describe('lastMilePredictedMinutes', () => {
  it('is null when distance is missing', () => {
    assert.equal(lastMilePredictedMinutes(undefined), null);
    assert.equal(lastMilePredictedMinutes(null), null);
  });

  it('is distanceKm * 2', () => {
    assert.equal(lastMilePredictedMinutes(1.5), 3);
  });
});

describe('predictedE2eMinutes', () => {
  it('is null when last-mile is missing', () => {
    assert.equal(predictedE2eMinutes(2, null), null);
  });

  it('is item + last-mile when both present', () => {
    assert.equal(predictedE2eMinutes(2, 3), 5);
  });
});

describe('formatDurationMmSs', () => {
  it('em dash for missing', () => {
    assert.equal(formatDurationMmSs(null), '—');
    assert.equal(formatDurationMmSs(undefined), '—');
  });

  it('m:ss under an hour', () => {
    assert.equal(formatDurationMmSs(0), '0:00');
    assert.equal(formatDurationMmSs(62), '1:02');
  });

  it('h:mm:ss at or above 3600s', () => {
    assert.equal(formatDurationMmSs(3600), '1:00:00');
  });
});

describe('LEG_IDS and LEG_THRESHOLDS', () => {
  it('lists six legs in order', () => {
    assert.deepEqual(LEG_IDS, [
      'created_to_confirmed',
      'confirmed_to_pick_start',
      'pick_start_to_pick_end',
      'pick_end_to_ofd',
      'ofd_to_reached',
      'reached_to_delivered'
    ]);
  });

  it('has absolute caps in seconds', () => {
    assert.deepEqual(LEG_THRESHOLDS.created_to_confirmed, { ok: 60, absurd: 180 });
    assert.deepEqual(LEG_THRESHOLDS.confirmed_to_pick_start, { ok: 120, absurd: 300 });
    assert.deepEqual(LEG_THRESHOLDS.pick_end_to_ofd, { ok: 120, absurd: 300 });
    assert.deepEqual(LEG_THRESHOLDS.reached_to_delivered, { ok: 180, absurd: 480 });
  });
});

describe('legTone', () => {
  it('created_to_confirmed uses absolute 60/180 caps', () => {
    assert.equal(legTone('created_to_confirmed', 60, emptyPred), 'ok');
    assert.equal(legTone('created_to_confirmed', 181, emptyPred), 'preposterous');
    assert.equal(legTone('created_to_confirmed', null, emptyPred), null);
  });

  it('pick start→end vs item predicted with 60s floor', () => {
    const pred = { itemMinutes: 1, lastMileMinutes: null, predictedE2eMinutes: null };
    assert.equal(legTone('pick_start_to_pick_end', 60, pred), 'ok');
    assert.equal(legTone('pick_start_to_pick_end', 61, pred), 'absurd');
    assert.equal(legTone('pick_start_to_pick_end', 120, pred), 'absurd');
    assert.equal(legTone('pick_start_to_pick_end', 121, pred), 'preposterous');
  });

  it('OFD→reached vs last-mile predicted with 60s floor', () => {
    const pred = { itemMinutes: 0, lastMileMinutes: 2, predictedE2eMinutes: null };
    assert.equal(legTone('ofd_to_reached', 120, pred), 'ok');
    assert.equal(legTone('ofd_to_reached', 240, pred), 'absurd');
    assert.equal(legTone('ofd_to_reached', 241, pred), 'preposterous');
  });
});

describe('e2eTone', () => {
  it('scores vs predicted e2e with 60s floor (5 min → 300s)', () => {
    assert.equal(e2eTone(300, 5), 'ok');
    assert.equal(e2eTone(301, 5), 'absurd');
    assert.equal(e2eTone(600, 5), 'absurd');
    assert.equal(e2eTone(601, 5), 'preposterous');
  });

  it('is null when actual or predicted is missing', () => {
    assert.equal(e2eTone(null, 5), null);
    assert.equal(e2eTone(300, null), null);
  });
});

function deliveredFixtures(): {
  order: OrderLike;
  events: OrderEventLike[];
  pick: PickTaskLike;
  trip: TripLike;
} {
  return {
    order: {
      orderNumber: 'ORD-DEL',
      status: 'DELIVERED',
      createdAt: '2026-08-26T09:00:00.000Z',
      items: [{ orderedQuantity: 3 }, { orderedQuantity: 4 }]
    },
    events: [
      { toStatus: 'CONFIRMED', occurredAt: '2026-08-26T09:00:30.000Z' },
      { toStatus: 'OUT_FOR_DELIVERY', occurredAt: '2026-08-26T09:03:30.000Z' },
      { toStatus: 'DELIVERED', occurredAt: '2026-08-26T09:07:30.000Z' }
    ],
    pick: {
      startedAt: '2026-08-26T09:01:30.000Z',
      completedAt: '2026-08-26T09:02:30.000Z'
    },
    trip: {
      order_id: 'ORD-DEL',
      distance_km: 1.5,
      reached_at: '2026-08-26T09:05:30.000Z',
      trip_status: 'completed'
    }
  };
}

describe('buildOrderLegRow', () => {
  it('delivered order with all timestamps fills six actuals', () => {
    const { order, events, pick, trip } = deliveredFixtures();
    const row = buildOrderLegRow({ order, events, pick, trip, nowMs: NOW_MS });

    assert.equal(row.orderNumber, 'ORD-DEL');
    assert.equal(row.status, 'DELIVERED');
    assert.equal(row.createdAt, '2026-08-26T09:00:00.000Z');
    assert.equal(row.units, 7);
    assert.equal(row.distanceKm, 1.5);
    assert.equal(row.itemPredictedMinutes, 2);
    assert.equal(row.lastMilePredictedMinutes, 3);
    assert.equal(row.predictedE2eMinutes, 5);
    assert.equal(row.actualE2eSeconds, 450);
    assert.equal(row.legs.length, 6);
    assert.deepEqual(
      row.legs.map((leg) => [leg.id, leg.actualSeconds]),
      [
        ['created_to_confirmed', 30],
        ['confirmed_to_pick_start', 60],
        ['pick_start_to_pick_end', 60],
        ['pick_end_to_ofd', 60],
        ['ofd_to_reached', 120],
        ['reached_to_delivered', 120]
      ]
    );
  });

  it('cancelled with only created+confirmed fills those two and rest null, no open elapsed', () => {
    const row = buildOrderLegRow({
      order: {
        orderNumber: 'ORD-CAN',
        status: 'CANCELLED',
        createdAt: '2026-08-26T09:00:00.000Z',
        items: [{ orderedQuantity: 2 }]
      },
      events: [{ toStatus: 'CONFIRMED', occurredAt: '2026-08-26T09:00:45.000Z' }],
      pick: null,
      trip: null,
      nowMs: NOW_MS
    });

    assert.equal(row.units, 2);
    assert.equal(row.distanceKm, null);
    assert.equal(row.lastMilePredictedMinutes, null);
    assert.equal(row.predictedE2eMinutes, null);
    assert.equal(row.actualE2eSeconds, 45);
    assert.deepEqual(
      row.legs.map((leg) => [leg.id, leg.actualSeconds]),
      [
        ['created_to_confirmed', 45],
        ['confirmed_to_pick_start', null],
        ['pick_start_to_pick_end', null],
        ['pick_end_to_ofd', null],
        ['ofd_to_reached', null],
        ['reached_to_delivered', null]
      ]
    );
    assert.equal(row.e2eTone, null);
  });

  it('in-flight after confirm uses now−confirmed for confirmed_to_pick_start', () => {
    const row = buildOrderLegRow({
      order: {
        orderNumber: 'ORD-IF',
        status: 'CONFIRMED',
        createdAt: '2026-08-26T09:50:00.000Z',
        items: [{ orderedQuantity: 1 }]
      },
      events: [{ toStatus: 'CONFIRMED', occurredAt: '2026-08-26T09:50:00.000Z' }],
      pick: null,
      trip: null,
      nowMs: NOW_MS
    });

    assert.equal(row.legs[0].actualSeconds, 0);
    assert.equal(row.legs[1].id, 'confirmed_to_pick_start');
    assert.equal(row.legs[1].actualSeconds, 600);
    assert.equal(row.legs[2].actualSeconds, null);
    assert.equal(row.actualE2eSeconds, 600);
  });

  it('hasRed is true when any tone is preposterous', () => {
    const { events, pick, trip } = deliveredFixtures();
    const row = buildOrderLegRow({
      order: {
        orderNumber: 'ORD-RED',
        status: 'DELIVERED',
        createdAt: '2026-08-26T08:50:00.000Z',
        items: [{ orderedQuantity: 1 }]
      },
      events: [
        { toStatus: 'CONFIRMED', occurredAt: '2026-08-26T08:54:00.000Z' },
        events[1],
        events[2]
      ],
      pick,
      trip,
      nowMs: NOW_MS
    });

    assert.equal(row.legs[0].actualSeconds, 240);
    assert.equal(row.legs[0].tone, 'preposterous');
    assert.equal(row.hasRed, true);
  });

  it('units is the sum of orderedQuantity', () => {
    const { events, pick, trip } = deliveredFixtures();
    const row = buildOrderLegRow({
      order: {
        orderNumber: 'ORD-UNITS',
        status: 'DELIVERED',
        createdAt: '2026-08-26T09:00:00.000Z',
        items: [{ orderedQuantity: 2 }, { orderedQuantity: null }, { orderedQuantity: 3 }]
      },
      events,
      pick,
      trip,
      nowMs: NOW_MS
    });
    assert.equal(row.units, 5);
    assert.equal(row.itemPredictedMinutes, 1);
  });
});
