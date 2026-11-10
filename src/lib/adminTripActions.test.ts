import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAdminMarkDrop, canAdminMarkPickup } from './adminTripActions';

describe('CurrentTripCard task actions', () => {
  const tasks = [
    { task_id: 'p1', type: 'pickup', status: 'completed' },
    { task_id: 'p2', type: 'pickup', status: 'created' },
    { task_id: 'd1', type: 'drop', status: 'created' },
    { task_id: 'd2', type: 'drop', status: 'created' }
  ];

  it('cannot mark the first completed pickup again; can mark the open pickup', () => {
    assert.equal(canAdminMarkPickup('accepted', tasks[0]), false);
    assert.equal(canAdminMarkPickup('accepted', tasks[1]), true);
  });

  it('disables drop buttons until the trip is out for delivery', () => {
    for (const task of tasks) {
      assert.equal(canAdminMarkDrop('accepted', task), false);
    }
    assert.equal(canAdminMarkDrop('out_for_delivery', tasks[2]), true);
    assert.equal(canAdminMarkDrop('out_for_delivery', tasks[3]), true);
    assert.equal(canAdminMarkDrop('out_for_delivery', tasks[0]), false);
  });
});
