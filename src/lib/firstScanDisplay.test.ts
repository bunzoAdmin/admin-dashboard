import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFirstScan } from './firstScanDisplay';

describe('formatFirstScan', () => {
  it('returns the Zambia HH:MM when a scan exists', () => {
    assert.equal(formatFirstScan('07:42'), '07:42');
  });

  it('returns Not scanned when the rider has no store QR that day', () => {
    assert.equal(formatFirstScan(null), 'Not scanned');
    assert.equal(formatFirstScan(undefined), 'Not scanned');
    assert.equal(formatFirstScan(''), 'Not scanned');
  });
});
