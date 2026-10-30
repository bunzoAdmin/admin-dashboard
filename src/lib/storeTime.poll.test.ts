import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBackgroundPollPaused, storeHour } from './storeTime';

describe('isBackgroundPollPaused', () => {
  it('pauses from 23:00 CAT until 06:00 CAT', () => {
    assert.equal(storeHour(new Date('2026-10-30T20:59:00Z')), 22);
    assert.equal(isBackgroundPollPaused(new Date('2026-10-30T20:59:00Z')), false);

    assert.equal(storeHour(new Date('2026-10-30T21:00:00Z')), 23);
    assert.equal(isBackgroundPollPaused(new Date('2026-10-30T21:00:00Z')), true);

    assert.equal(storeHour(new Date('2026-10-31T03:59:00Z')), 5);
    assert.equal(isBackgroundPollPaused(new Date('2026-10-31T03:59:00Z')), true);

    assert.equal(storeHour(new Date('2026-10-31T04:00:00Z')), 6);
    assert.equal(isBackgroundPollPaused(new Date('2026-10-31T04:00:00Z')), false);

    assert.equal(isBackgroundPollPaused(new Date('2026-10-30T12:00:00Z')), false);
  });
});
