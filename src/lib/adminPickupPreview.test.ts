import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AdminDropPreview } from './types';
import {
  assignedDuringConfirmMessage,
  blockedPickupMessage,
  canConfirmAdminPickup,
  forceProgressPickupCopy,
  runAdminPickupConfirm
} from './adminPickupPreview';

const rider = { phone: '+260971000101', name: 'Chanda', status: 'eligible' };

function pickRider(): AdminDropPreview {
  return {
    mode: 'pick_rider',
    trip_status: 'created',
    candidates: [{ phone: rider.phone, name: rider.name, status: 'eligible', in_hand_cash_zmw: 12 }]
  };
}

describe('canConfirmAdminPickup', () => {
  it('disables confirm when the eligible list is empty', () => {
    const preview: AdminDropPreview = { mode: 'pick_rider', candidates: [] };
    assert.equal(canConfirmAdminPickup(preview, rider.phone), false);
    assert.equal(canConfirmAdminPickup({ mode: 'pick_rider' }, rider.phone), false);
  });

  it('disables confirm until a rider is selected', () => {
    assert.equal(canConfirmAdminPickup(pickRider(), ''), false);
    assert.equal(canConfirmAdminPickup(pickRider(), rider.phone), true);
  });
});

describe('pickup copy', () => {
  it('uses the assigned-trip accept copy', () => {
    assert.equal(
      forceProgressPickupCopy('assigned', 'Chanda'),
      'Accept this trip for Chanda and mark the order out for delivery? This completes pickup and sends the customer the OTP.'
    );
  });

  it('uses the accepted-trip copy for any other force_progress status', () => {
    const copy =
      'Mark this order out for delivery for Chanda? This completes pickup and sends the customer the OTP.';
    assert.equal(forceProgressPickupCopy('accepted', 'Chanda'), copy);
    assert.equal(forceProgressPickupCopy('created', 'Chanda'), copy);
  });

  it('names the lost-assign race', () => {
    assert.equal(
      assignedDuringConfirmMessage('Chanda'),
      'This trip was just assigned to Chanda. Out for delivery was not changed. They will pick up normally.'
    );
  });

  it('explains a missing trip and a busy rider', () => {
    assert.equal(
      blockedPickupMessage('no_trip'),
      'No delivery trip yet. Out for delivery was not changed.'
    );
    assert.equal(
      blockedPickupMessage('rider_busy_elsewhere'),
      'Assigned rider is on another trip. Reassign this order first.'
    );
  });
});

describe('runAdminPickupConfirm', () => {
  it('pick_rider confirm calls assign, then pickup complete', async () => {
    const calls: string[] = [];
    const result = await runAdminPickupConfirm({
      preview: pickRider(),
      selectedPhone: rider.phone,
      assign: async (phone) => {
        calls.push(`assign:${phone}`);
      },
      complete: async () => {
        calls.push('pickup');
      },
      reload: async () => {
        throw new Error('reload');
      },
      errorMessage: (err) => (err instanceof Error ? err.message : 'failed')
    });
    assert.deepEqual(calls, [`assign:${rider.phone}`, 'pickup']);
    assert.equal(result.ok, true);
  });

  it('does not call pickup complete when assign fails, and stops on a force_progress reload', async () => {
    const calls: string[] = [];
    const reloaded: AdminDropPreview = {
      mode: 'force_progress',
      trip_status: 'assigned',
      rider
    };
    const result = await runAdminPickupConfirm({
      preview: pickRider(),
      selectedPhone: rider.phone,
      assign: async () => {
        calls.push('assign');
        throw new Error('ORDER_NOT_ASSIGNABLE');
      },
      complete: async () => {
        calls.push('pickup');
      },
      reload: async () => reloaded,
      errorMessage: (err) => (err instanceof Error ? err.message : 'failed')
    });
    assert.deepEqual(calls, ['assign']);
    assert.equal(result.ok, false);
    if (result.ok || result.kind !== 'assign_lost') {
      assert.fail(`expected assign_lost, got ${JSON.stringify(result)}`);
    }
    assert.equal(
      result.message,
      'This trip was just assigned to Chanda. Out for delivery was not changed. They will pick up normally.'
    );
  });

  it('keeps the refreshed list when assign fails and the trip is still pooled', async () => {
    const calls: string[] = [];
    const refreshed = pickRider();
    const result = await runAdminPickupConfirm({
      preview: pickRider(),
      selectedPhone: rider.phone,
      assign: async () => {
        calls.push('assign');
        throw new Error('driver not eligible');
      },
      complete: async () => {
        calls.push('pickup');
      },
      reload: async () => refreshed,
      errorMessage: (err) => (err instanceof Error ? err.message : 'failed')
    });
    assert.deepEqual(calls, ['assign']);
    assert.equal(result.ok, false);
    if (result.ok || result.kind !== 'assign_error') {
      assert.fail(`expected assign_error, got ${JSON.stringify(result)}`);
    }
    assert.equal(result.message, 'driver not eligible');
    assert.equal(result.preview, refreshed);
  });

  it('leaves a later confirm as pickup complete only after assign succeeds and pickup fails', async () => {
    const calls: string[] = [];
    const later: AdminDropPreview = {
      mode: 'force_progress',
      trip_status: 'accepted',
      rider: { ...rider, status: 'busy' }
    };
    const failed = await runAdminPickupConfirm({
      preview: pickRider(),
      selectedPhone: rider.phone,
      assign: async () => {
        calls.push('assign');
      },
      complete: async () => {
        calls.push('pickup');
        throw new Error('pickup refused');
      },
      reload: async () => later,
      errorMessage: (err) => (err instanceof Error ? err.message : 'failed')
    });
    assert.deepEqual(calls, ['assign', 'pickup']);
    assert.equal(failed.ok, false);
    if (failed.ok || failed.kind !== 'pickup_error' || !failed.preview) {
      assert.fail(`expected pickup_error with preview, got ${JSON.stringify(failed)}`);
    }

    const retryCalls: string[] = [];
    const retry = await runAdminPickupConfirm({
      preview: failed.preview,
      selectedPhone: '',
      assign: async () => {
        retryCalls.push('assign');
      },
      complete: async () => {
        retryCalls.push('pickup');
      },
      reload: async () => {
        throw new Error('reload');
      },
      errorMessage: () => 'failed'
    });
    assert.deepEqual(retryCalls, ['pickup']);
    assert.equal(retry.ok, true);
  });

  it('assigned confirm calls pickup complete and does not call assign', async () => {
    const calls: string[] = [];
    const result = await runAdminPickupConfirm({
      preview: { mode: 'force_progress', trip_status: 'assigned', rider },
      selectedPhone: '',
      assign: async () => {
        calls.push('assign');
      },
      complete: async () => {
        calls.push('pickup');
      },
      reload: async () => {
        throw new Error('reload');
      },
      errorMessage: () => 'failed'
    });
    assert.deepEqual(calls, ['pickup']);
    assert.equal(result.ok, true);
  });
});
