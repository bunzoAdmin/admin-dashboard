import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterLegRows, pageLegRows } from './orderLegsView';
import type { OrderLegRow } from './orderLegs';

function row(overrides: Partial<OrderLegRow> = {}): OrderLegRow {
  return {
    orderNumber: 'BNZ-1',
    status: 'DELIVERED',
    createdAt: '2026-08-26T00:00:00.000Z',
    units: 1,
    distanceKm: 1,
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

  it('has_red is hasRed regardless of status', () => {
    assert.deepEqual(
      filterLegRows(rows, 'has_red').map((r) => r.orderNumber),
      ['R', 'DR']
    );
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
