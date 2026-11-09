import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminDropReasonReady, canConfirmAdminDrop, adminDropConfirmLabel } from './adminDropPreview.ts';

test('canConfirmAdminDrop: pick_rider without a phone is disabled', () => {
  assert.equal(canConfirmAdminDrop('pick_rider', ''), false);
});

test('canConfirmAdminDrop: pick_rider with a phone is enabled', () => {
  assert.equal(canConfirmAdminDrop('pick_rider', '+2601'), true);
});

test('canConfirmAdminDrop: java_only does not need a phone', () => {
  assert.equal(canConfirmAdminDrop('java_only', ''), true);
});

test('canConfirmAdminDrop: blocked stays disabled even with a phone', () => {
  assert.equal(canConfirmAdminDrop('blocked', '+2601'), false);
});

test('adminDropConfirmLabel: java_only', () => {
  assert.equal(adminDropConfirmLabel('java_only'), 'Mark delivered (no trip)');
});

test('adminDropConfirmLabel: pick_rider', () => {
  assert.equal(adminDropConfirmLabel('pick_rider'), 'Assign and mark delivered');
});

test('adminDropConfirmLabel: force_progress', () => {
  assert.equal(adminDropConfirmLabel('force_progress'), 'Mark delivered');
});

test('adminDropReasonReady: empty is not ready', () => {
  assert.equal(adminDropReasonReady('', ''), false);
});

test('adminDropReasonReady: preset is ready without a note', () => {
  assert.equal(adminDropReasonReady('otp_not_provided', ''), true);
  assert.equal(adminDropReasonReady('internal_purchase', ''), true);
  assert.equal(adminDropReasonReady('batched_order', ''), true);
});

test('adminDropReasonReady: not_listed needs trimmed text', () => {
  assert.equal(adminDropReasonReady('not_listed', ''), false);
  assert.equal(adminDropReasonReady('not_listed', '   '), false);
  assert.equal(adminDropReasonReady('not_listed', 'customer left it'), true);
});

test('adminDropReasonReady: unknown code is rejected', () => {
  assert.equal(adminDropReasonReady('something_else', 'text'), false);
});
