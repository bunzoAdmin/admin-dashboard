import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canClearAmount,
  dayStartLabel,
  noShiftStartMessage,
  presenceRowStart,
  signedClearAmount,
  canClearPunctuality,
  canRemoveShiftStart,
  formatSignedMinutes,
  listedShiftStarts,
  punctualityTone,
  riderListPunctuality
} from './punctualityDisplay';

describe('dayStartLabel', () => {
  it('shows Not scanned when the start has no score', () => {
    assert.equal(dayStartLabel({ scored: false, signed_minutes: 0 }), 'Not scanned');
  });

  it('shows the signed minutes when the start has a score', () => {
    assert.equal(dayStartLabel({ scored: true, signed_minutes: -10 }), '−10m');
  });
});

describe('presenceRowStart', () => {
  it('names the shift start when the row is unscored', () => {
    const row = { shift_start: '08:00', scored: false, signed_minutes: 0 };
    assert.equal(presenceRowStart(row), '08:00');
    assert.equal(dayStartLabel(row), 'Not scanned');
  });

  it('names the shift start when the row is scored', () => {
    const row = { shift_start: '16:00', scored: true, signed_minutes: -10 };
    assert.equal(presenceRowStart(row), '16:00');
    assert.equal(dayStartLabel(row), '−10m');
  });
});

describe('noShiftStartMessage', () => {
  it('says there is no shift start when the day has none', () => {
    assert.equal(noShiftStartMessage(0), 'There is no shift start.');
  });

  it('stays blank when the day has a start', () => {
    assert.equal(noShiftStartMessage(1), '');
  });
});

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

describe('canClearAmount', () => {
  it('accepts hours and minutes toward zero and refuses zero or more than the open total', () => {
    assert.equal(canClearAmount(-150, 1, 30), true);
    assert.equal(canClearAmount(150, 1, 30), true);
    assert.equal(canClearAmount(-60, 1, 0), true);
    assert.equal(canClearAmount(-150, 0, 0), false);
    assert.equal(canClearAmount(0, 1, 0), false);
    assert.equal(canClearAmount(-150, 3, 0), false);
    assert.equal(canClearAmount(-150, 1, 60), false);
    assert.equal(signedClearAmount(-150, 1, 30), -90);
    assert.equal(signedClearAmount(150, 1, 30), 90);
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
