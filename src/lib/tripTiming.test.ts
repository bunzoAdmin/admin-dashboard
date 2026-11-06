import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTripMinutes, tripTimingNote } from './tripTiming';

describe('formatTripMinutes', () => {
  it('rounds to whole minutes', () => {
    assert.equal(formatTripMinutes(12.4), '12 min');
    assert.equal(formatTripMinutes(12.5), '13 min');
    assert.equal(formatTripMinutes(0), '0 min');
  });

  it('shows a dash when there is no reliable timing', () => {
    assert.equal(formatTripMinutes(null), '—');
    assert.equal(formatTripMinutes(undefined), '—');
  });
});

describe('tripTimingNote', () => {
  it('explains an admin-synthesized arrival', () => {
    assert.equal(tripTimingNote({ missing_arrival: true, return_min: null }), "Driver didn't mark arrived");
  });

  it('explains a missing return scan', () => {
    assert.equal(tripTimingNote({ missing_arrival: false, return_min: null }), 'No return scan recorded');
  });

  it('has no note when both timings exist', () => {
    assert.equal(tripTimingNote({ missing_arrival: false, return_min: 15 }), undefined);
  });
});
