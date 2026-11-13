import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canConfirmAssignRider, eligibleAssignRiders, showAssignRider } from './assignRider';

describe('showAssignRider', () => {
  it('shows the button only for a pooled live trip on an open order', () => {
    assert.equal(showAssignRider('READY_FOR_DELIVERY', { status: 'created' }), true);
    assert.equal(showAssignRider('PACKING', { status: 'created' }), true);
  });

  it('hides the button once the trip has left the pool', () => {
    assert.equal(showAssignRider('READY_FOR_DELIVERY', { status: 'accepted' }), false);
    assert.equal(showAssignRider('OUT_FOR_DELIVERY', { status: 'out_for_delivery' }), false);
  });

  it('hides the button when there is no live trip', () => {
    assert.equal(showAssignRider('READY_FOR_DELIVERY', null), false);
  });

  it('hides the button for delivered and cancelled orders even if the trip is still pooled', () => {
    assert.equal(showAssignRider('DELIVERED', { status: 'created' }), false);
    assert.equal(showAssignRider('CANCELLED', { status: 'created' }), false);
  });
});

describe('eligibleAssignRiders', () => {
  it('keeps eligible riders as name and phone, in list order', () => {
    const riders = eligibleAssignRiders([
      { name: 'Busy Rider', phone_number: '+2601', status: 'busy' },
      { name: 'Mwansa Phiri', phone_number: '+26097', status: 'eligible' },
      { name: 'Free Rider', phone_number: '+2602', status: 'free' },
      { name: 'Amina Banda', phone_number: '+26096', status: 'eligible' }
    ]);
    assert.deepEqual(riders, [
      { name: 'Mwansa Phiri', phone: '+26097' },
      { name: 'Amina Banda', phone: '+26096' }
    ]);
  });

  it('returns an empty list when nobody is eligible', () => {
    assert.deepEqual(eligibleAssignRiders([{ name: 'Busy', phone_number: '+1', status: 'busy' }]), []);
  });
});

describe('canConfirmAssignRider', () => {
  const ready = { selectedPhone: '+26097', loading: false, error: null, riderCount: 2 };

  it('enables confirm only when a rider is selected and the list loaded', () => {
    assert.equal(canConfirmAssignRider(ready), true);
  });

  it('disables confirm with no selection, while loading, on error, or with an empty list', () => {
    assert.equal(canConfirmAssignRider({ ...ready, selectedPhone: '' }), false);
    assert.equal(canConfirmAssignRider({ ...ready, selectedPhone: '  ' }), false);
    assert.equal(canConfirmAssignRider({ ...ready, loading: true }), false);
    assert.equal(canConfirmAssignRider({ ...ready, error: 'nope' }), false);
    assert.equal(canConfirmAssignRider({ ...ready, riderCount: 0 }), false);
  });
});
