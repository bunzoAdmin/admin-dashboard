import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderStatusAdvanceAction, showStatusAdvanceNotes } from './orderStatusAdvance';

describe('orderStatusAdvanceAction', () => {
  it('routes OUT_FOR_DELIVERY to qcom pickup complete', () => {
    assert.equal(orderStatusAdvanceAction('OUT_FOR_DELIVERY'), 'qcom-pickup');
  });
  it('keeps DELIVERED on qcom drop complete', () => {
    assert.equal(orderStatusAdvanceAction('DELIVERED'), 'qcom-drop');
  });
  it('keeps earlier statuses on Java updateStatus', () => {
    assert.equal(orderStatusAdvanceAction('READY_FOR_DELIVERY'), 'java');
    assert.equal(orderStatusAdvanceAction('PACKING'), 'java');
  });
});

describe('showStatusAdvanceNotes', () => {
  it('hides notes for OFD and DELIVERED', () => {
    assert.equal(showStatusAdvanceNotes('OUT_FOR_DELIVERY'), false);
    assert.equal(showStatusAdvanceNotes('DELIVERED'), false);
  });
  it('shows notes for Java-backed advances', () => {
    assert.equal(showStatusAdvanceNotes('READY_FOR_DELIVERY'), true);
  });
});
