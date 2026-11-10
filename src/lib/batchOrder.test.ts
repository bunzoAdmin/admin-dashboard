import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBatchExpectedUpdatedAt,
  isAppTooOldError,
  isBatchingDisabledError,
  isStaleMergeError
} from './batchOrder';

describe('buildBatchExpectedUpdatedAt', () => {
  const candidate = {
    trip_id: 'tgt-1',
    trip_updated_at: '2026-11-10T10:00:00+02:00'
  };

  it('always includes the selected candidate trip timestamp', () => {
    assert.deepEqual(buildBatchExpectedUpdatedAt(candidate), {
      'tgt-1': '2026-11-10T10:00:00+02:00'
    });
  });

  it('adds source trip timestamps when both are present', () => {
    assert.deepEqual(
      buildBatchExpectedUpdatedAt(candidate, {
        source_trip_id: 'src-9',
        source_trip_updated_at: '2026-11-10T09:55:00+02:00'
      }),
      {
        'tgt-1': '2026-11-10T10:00:00+02:00',
        'src-9': '2026-11-10T09:55:00+02:00'
      }
    );
  });

  it('does not invent a source timestamp when source_trip_id is missing', () => {
    assert.deepEqual(
      buildBatchExpectedUpdatedAt(candidate, {
        source_trip_updated_at: '2026-11-10T09:55:00+02:00'
      }),
      { 'tgt-1': '2026-11-10T10:00:00+02:00' }
    );
  });

  it('does not invent a source timestamp when source_trip_updated_at is missing', () => {
    assert.deepEqual(
      buildBatchExpectedUpdatedAt(candidate, { source_trip_id: 'src-9' }),
      { 'tgt-1': '2026-11-10T10:00:00+02:00' }
    );
  });
});

describe('batch error codes', () => {
  it('hides Batch on 403 BATCHING_DISABLED', () => {
    assert.equal(isBatchingDisabledError({ status: 403, code: 'BATCHING_DISABLED' }), true);
    assert.equal(isBatchingDisabledError({ status: 403, code: 'FORBIDDEN' }), false);
    assert.equal(isBatchingDisabledError({ status: 409, code: 'BATCHING_DISABLED' }), false);
  });

  it('detects 409 STALE_MERGE without treating it as success', () => {
    assert.equal(isStaleMergeError({ status: 409, code: 'STALE_MERGE' }), true);
    assert.equal(isStaleMergeError({ status: 200, code: 'STALE_MERGE' }), false);
  });

  it('detects 409 APP_TOO_OLD', () => {
    assert.equal(isAppTooOldError({ status: 409, code: 'APP_TOO_OLD' }), true);
    assert.equal(isAppTooOldError({ status: 409, code: 'STALE_MERGE' }), false);
  });
});
