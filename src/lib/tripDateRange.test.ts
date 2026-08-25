import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTripRange, tripRangeError, TRIP_MAX_CUSTOM_RANGE_DAYS } from './tripDateRange';
import { addStoreCalendarDays, todayIsoStore } from './storeTime';

describe('TRIP_MAX_CUSTOM_RANGE_DAYS', () => {
  it('is 7', () => {
    assert.equal(TRIP_MAX_CUSTOM_RANGE_DAYS, 7);
  });
});

describe('resolveTripRange', () => {
  it('today is today through today', () => {
    const today = todayIsoStore();
    assert.deepEqual(resolveTripRange('today', '', ''), { from: today, to: today });
  });

  it('last7 starts 6 calendar days back', () => {
    const today = todayIsoStore();
    assert.deepEqual(resolveTripRange('last7', '', ''), {
      from: addStoreCalendarDays(today, -6),
      to: today
    });
  });

  it('custom without both dates returns null', () => {
    assert.equal(resolveTripRange('custom', '', ''), null);
    assert.equal(resolveTripRange('custom', '2026-01-01', ''), null);
    assert.equal(resolveTripRange('custom', '', '2026-01-07'), null);
  });

  it('custom 7-day range resolves', () => {
    assert.deepEqual(resolveTripRange('custom', '2026-01-01', '2026-01-07'), {
      from: '2026-01-01',
      to: '2026-01-07'
    });
  });
});

describe('tripRangeError', () => {
  it('today and last7 have no error', () => {
    assert.equal(tripRangeError('today', '', ''), null);
    assert.equal(tripRangeError('last7', '', ''), null);
  });

  it('custom missing dates', () => {
    assert.equal(tripRangeError('custom', '', ''), 'Pick a from and to date.');
    assert.equal(tripRangeError('custom', '2026-01-01', ''), 'Pick a from and to date.');
    assert.equal(tripRangeError('custom', '', '2026-01-07'), 'Pick a from and to date.');
  });

  it('inverted dates', () => {
    assert.equal(
      tripRangeError('custom', '2026-01-08', '2026-01-01'),
      '"To" date must be on or after "from" date.'
    );
  });

  it('custom 7-day ok, 8-day error', () => {
    assert.equal(tripRangeError('custom', '2026-01-01', '2026-01-07'), null);
    assert.equal(
      tripRangeError('custom', '2026-01-01', '2026-01-08'),
      `Custom range can span at most ${TRIP_MAX_CUSTOM_RANGE_DAYS} days.`
    );
  });
});
