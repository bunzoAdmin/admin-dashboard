import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeLegAverages, filterLegRows, legAverageHint, nextLegSort, pageLegRows, sortLegRows } from './orderLegsView';
import type { LegId, OrderLegRow } from './orderLegs';
import { LEG_IDS } from './orderLegs';

function row(overrides: Partial<OrderLegRow> = {}): OrderLegRow {
  return {
    orderNumber: 'BNZ-1',
    status: 'DELIVERED',
    createdAt: '2026-08-26T00:00:00.000Z',
    units: 1,
    distanceKm: 1,
    batched: false,
    legs: [],
    itemPredictedMinutes: 1,
    lastMilePredictedMinutes: 2,
    predictedE2eMinutes: 3,
    actualE2eSeconds: 60,
    e2eTone: 'ok',
    hasRed: false,
    ...overrides
  };
}

describe('filterLegRows', () => {
  const delivered = row({ orderNumber: 'D', status: 'DELIVERED', hasRed: false });
  const cancelled = row({ orderNumber: 'C', status: 'CANCELLED', hasRed: false });
  const packing = row({ orderNumber: 'P', status: 'PACKING', hasRed: false });
  const ofdRed = row({ orderNumber: 'R', status: 'OUT_FOR_DELIVERY', hasRed: true });
  const deliveredRed = row({ orderNumber: 'DR', status: 'DELIVERED', hasRed: true });
  const rows = [delivered, cancelled, packing, ofdRed, deliveredRed];

  it('all returns every row', () => {
    assert.deepEqual(
      filterLegRows(rows, 'all').map((r) => r.orderNumber),
      ['D', 'C', 'P', 'R', 'DR']
    );
  });

  it('delivered is status DELIVERED', () => {
    assert.deepEqual(
      filterLegRows(rows, 'delivered').map((r) => r.orderNumber),
      ['D', 'DR']
    );
  });

  it('cancelled is status CANCELLED', () => {
    assert.deepEqual(
      filterLegRows(rows, 'cancelled').map((r) => r.orderNumber),
      ['C']
    );
  });

  it('in_flight is neither DELIVERED nor CANCELLED', () => {
    assert.deepEqual(
      filterLegRows(rows, 'in_flight').map((r) => r.orderNumber),
      ['P', 'R']
    );
  });

  it('does not treat an in-flight order as cancelled (inactive is a trip status, not an order status)', () => {
    const ofd = row({ orderNumber: 'I', status: 'OUT_FOR_DELIVERY', hasRed: false });
    assert.deepEqual(filterLegRows([ofd], 'cancelled'), []);
    assert.equal(filterLegRows([ofd], 'in_flight')[0].orderNumber, 'I');
  });

  it('has_red is hasRed regardless of status', () => {
    assert.deepEqual(
      filterLegRows(rows, 'has_red').map((r) => r.orderNumber),
      ['R', 'DR']
    );
  });

  it('batched is the trip batch flag regardless of status', () => {
    const batchDelivered = row({ orderNumber: 'BD', status: 'DELIVERED', batched: true });
    const batchFlight = row({ orderNumber: 'BF', status: 'OUT_FOR_DELIVERY', batched: true });
    assert.deepEqual(
      filterLegRows([...rows, batchDelivered, batchFlight], 'batched').map((r) => r.orderNumber),
      ['BD', 'BF']
    );
  });
});

function legs(durations: Partial<Record<LegId, number | null>>): OrderLegRow['legs'] {
  return LEG_IDS.map((id) => ({
    id,
    actualSeconds: durations[id] ?? null,
    tone: null
  }));
}

describe('computeLegAverages', () => {
  it('averages each leg over non-null samples in the row set', () => {
    const result = computeLegAverages([
      row({
        orderNumber: 'A',
        legs: legs({
          created_to_confirmed: 60,
          confirmed_to_pick_start: 120,
          pick_start_to_pick_end: 180
        }),
        actualE2eSeconds: 600
      }),
      row({
        orderNumber: 'B',
        legs: legs({
          created_to_confirmed: 120,
          confirmed_to_pick_start: null,
          pick_start_to_pick_end: 240
        }),
        actualE2eSeconds: 900
      })
    ]);

    assert.equal(result.orderCount, 2);
    assert.equal(result.byLeg.created_to_confirmed.avgSeconds, 90);
    assert.equal(result.byLeg.created_to_confirmed.sampleCount, 2);
    assert.equal(result.byLeg.confirmed_to_pick_start.avgSeconds, 120);
    assert.equal(result.byLeg.confirmed_to_pick_start.sampleCount, 1);
    assert.equal(result.byLeg.pick_start_to_pick_end.avgSeconds, 210);
    assert.equal(result.byLeg.ofd_to_reached.avgSeconds, null);
    assert.equal(result.byLeg.ofd_to_reached.sampleCount, 0);
    assert.equal(result.actualE2e.avgSeconds, 750);
    assert.equal(result.actualE2e.sampleCount, 2);
  });

  it('returns null averages for an empty row set', () => {
    const result = computeLegAverages([]);
    assert.equal(result.orderCount, 0);
    for (const id of LEG_IDS) {
      assert.equal(result.byLeg[id].avgSeconds, null);
      assert.equal(result.byLeg[id].sampleCount, 0);
    }
    assert.equal(result.actualE2e.avgSeconds, null);
  });

  it('ignores non-delivered orders', () => {
    const result = computeLegAverages([
      row({
        orderNumber: 'D',
        status: 'DELIVERED',
        legs: legs({ created_to_confirmed: 100 }),
        actualE2eSeconds: 500
      }),
      row({
        orderNumber: 'P',
        status: 'PACKING',
        legs: legs({ created_to_confirmed: 10 }),
        actualE2eSeconds: 50
      }),
      row({
        orderNumber: 'C',
        status: 'CANCELLED',
        legs: legs({ created_to_confirmed: 20 }),
        actualE2eSeconds: 80
      })
    ]);

    assert.equal(result.orderCount, 1);
    assert.equal(result.byLeg.created_to_confirmed.avgSeconds, 100);
    assert.equal(result.actualE2e.avgSeconds, 500);
  });
});

describe('legAverageHint', () => {
  it('explains partial leg samples', () => {
    assert.equal(legAverageHint({ avgSeconds: 90, sampleCount: 38 }, 42), '38 of 42 delivered orders have this leg');
    assert.equal(legAverageHint({ avgSeconds: 90, sampleCount: 42 }, 42), '42 delivered orders');
    assert.equal(legAverageHint({ avgSeconds: null, sampleCount: 0 }, 42), undefined);
  });
});

describe('sortLegRows', () => {
  const slow = row({
    orderNumber: 'SLOW',
    status: 'DELIVERED',
    createdAt: '2026-11-15T07:30:00.000Z',
    units: 1,
    distanceKm: 1.4,
    legs: legs({ ofd_to_reached: 400, created_to_confirmed: 10 }),
    actualE2eSeconds: 900
  });
  const fast = row({
    orderNumber: 'FAST',
    status: 'PACKING',
    createdAt: '2026-11-15T08:00:00.000Z',
    units: 4,
    distanceKm: null,
    legs: legs({ ofd_to_reached: 30, created_to_confirmed: 5 }),
    actualE2eSeconds: 80
  });
  const blank = row({
    orderNumber: 'BLANK',
    status: 'CANCELLED',
    createdAt: '2026-11-15T07:00:00.000Z',
    units: 2,
    distanceKm: 9,
    legs: legs({ ofd_to_reached: null, created_to_confirmed: 20 }),
    actualE2eSeconds: null
  });
  const rows = [slow, fast, blank];

  it('leaves the loaded order when no sort is selected', () => {
    assert.deepEqual(
      sortLegRows(rows, null).map((r) => r.orderNumber),
      ['SLOW', 'FAST', 'BLANK']
    );
  });

  it('sorts a time leg slowest first, with missing times last', () => {
    assert.deepEqual(
      sortLegRows(rows, { key: 'ofd_to_reached', dir: 'desc' }).map((r) => r.orderNumber),
      ['SLOW', 'FAST', 'BLANK']
    );
  });

  it('sorts a time leg fastest first, still keeping missing times last', () => {
    assert.deepEqual(
      sortLegRows(rows, { key: 'ofd_to_reached', dir: 'asc' }).map((r) => r.orderNumber),
      ['FAST', 'SLOW', 'BLANK']
    );
  });

  it('sorts km with an empty distance last', () => {
    assert.deepEqual(
      sortLegRows(rows, { key: 'km', dir: 'desc' }).map((r) => r.orderNumber),
      ['BLANK', 'SLOW', 'FAST']
    );
  });

  it('sorts created newest first', () => {
    assert.deepEqual(
      sortLegRows(rows, { key: 'created', dir: 'desc' }).map((r) => r.orderNumber),
      ['FAST', 'SLOW', 'BLANK']
    );
  });

  it('toggles the same column and starts a time column at descending', () => {
    const first = nextLegSort(null, 'ofd_to_reached');
    assert.deepEqual(first, { key: 'ofd_to_reached', dir: 'desc' });
    assert.deepEqual(nextLegSort(first, 'ofd_to_reached'), { key: 'ofd_to_reached', dir: 'asc' });
    assert.deepEqual(nextLegSort(first, 'order'), { key: 'order', dir: 'asc' });
  });
});

describe('pageLegRows', () => {
  const rows = Array.from({ length: 105 }, (_, i) => row({ orderNumber: `O${i}` }));

  it('page 0 returns the first 50', () => {
    const page = pageLegRows(rows, 0);
    assert.equal(page.length, 50);
    assert.equal(page[0].orderNumber, 'O0');
    assert.equal(page[49].orderNumber, 'O49');
  });

  it('page 1 returns the next 50', () => {
    const page = pageLegRows(rows, 1);
    assert.equal(page.length, 50);
    assert.equal(page[0].orderNumber, 'O50');
    assert.equal(page[49].orderNumber, 'O99');
  });

  it('last partial page returns the remainder', () => {
    const page = pageLegRows(rows, 2);
    assert.equal(page.length, 5);
    assert.equal(page[0].orderNumber, 'O100');
    assert.equal(page[4].orderNumber, 'O104');
  });

  it('out-of-range page returns empty', () => {
    assert.deepEqual(pageLegRows(rows, 3), []);
    assert.deepEqual(pageLegRows(rows, -1), []);
  });

  it('default size is 50', () => {
    assert.equal(pageLegRows(rows, 0).length, 50);
    assert.equal(pageLegRows(rows, 0, 50).length, 50);
  });
});
