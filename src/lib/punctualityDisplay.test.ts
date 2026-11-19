import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canClearPunctuality,
  canRemoveShiftStart,
  formatSignedMinutes,
  listedShiftStarts,
  punctualityTone,
  riderListPunctuality
} from './punctualityDisplay';

describe('formatSignedMinutes', () => {
  it('shows early time in hours and minutes with a plus', () => {
    assert.equal(formatSignedMinutes(80), '+1h 20m');
  });

  it('shows late minutes with a minus', () => {
    assert.equal(formatSignedMinutes(-25), '−25m');
  });

  it('shows a whole early hour without leftover minutes', () => {
    assert.equal(formatSignedMinutes(120), '+2h');
  });

  it('shows on time as zero', () => {
    assert.equal(formatSignedMinutes(0), '0');
  });
});

describe('punctualityTone', () => {
  it('is green for early, red for late, and neutral on time', () => {
    assert.equal(punctualityTone(1), 'green');
    assert.equal(punctualityTone(-1), 'red');
    assert.equal(punctualityTone(0), 'neutral');
  });
});

describe('canClearPunctuality', () => {
  it('allows a positive or negative total and refuses zero', () => {
    assert.equal(canClearPunctuality(15), true);
    assert.equal(canClearPunctuality(-20), true);
    assert.equal(canClearPunctuality(0), false);
  });
});

describe('listedShiftStarts', () => {
  it('sorts the saved times and falls back to the single start', () => {
    assert.deepEqual(listedShiftStarts(['16:00', '08:00']), ['08:00', '16:00']);
    assert.deepEqual(listedShiftStarts([], '08:00'), ['08:00']);
    assert.deepEqual(listedShiftStarts(undefined, ''), []);
  });

  it('allows removing a start only while another remains', () => {
    assert.equal(canRemoveShiftStart(2), true);
    assert.equal(canRemoveShiftStart(1), false);
  });
});

describe('riderListPunctuality', () => {
  it('shows dashes before a shift start exists', () => {
    const cell = riderListPunctuality({
      shiftStart: '',
      lastScoredDate: '',
      lastScoredMinutes: 0,
      openMinutes: 0,
      today: '2026-06-22'
    });
    assert.equal(cell.today, '—');
    assert.equal(cell.open, '—');
    assert.equal(cell.todayTone, 'neutral');
    assert.equal(cell.openTone, 'neutral');
  });

  it('shows not scanned today and keeps the open total', () => {
    const cell = riderListPunctuality({
      shiftStart: '08:00',
      lastScoredDate: '2026-06-21',
      lastScoredMinutes: -20,
      openMinutes: -20,
      today: '2026-06-22'
    });
    assert.equal(cell.today, 'Not scanned');
    assert.equal(cell.todayTone, 'neutral');
    assert.equal(cell.open, '−20m');
    assert.equal(cell.openTone, 'red');
  });

  it('shows today when the latest score is today', () => {
    const cell = riderListPunctuality({
      shiftStart: '08:00',
      lastScoredDate: '2026-06-22',
      lastScoredMinutes: 20,
      openMinutes: 20,
      today: '2026-06-22'
    });
    assert.equal(cell.today, '+20m');
    assert.equal(cell.todayTone, 'green');
    assert.equal(cell.open, '+20m');
    assert.equal(cell.openTone, 'green');
  });
});
