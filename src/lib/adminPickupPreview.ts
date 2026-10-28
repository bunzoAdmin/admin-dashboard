import type { AdminDropPreview } from './types';

export function canConfirmAdminPickup(preview: AdminDropPreview, selectedPhone: string): boolean {
  if (preview.mode === 'blocked' || preview.mode === 'already_done') return false;
  if (preview.mode === 'pick_rider') {
    return Boolean(selectedPhone) && (preview.candidates?.length ?? 0) > 0;
  }
  return preview.mode === 'java_only' || preview.mode === 'force_progress';
}

export function blockedPickupMessage(reason?: string): string {
  switch (reason) {
    case 'no_trip':
      return 'No delivery trip yet. Out for delivery was not changed.';
    case 'rider_busy_elsewhere':
      return 'Assigned rider is on another trip. Reassign this order first.';
    case 'java_cancelled':
      return 'This order is cancelled.';
    case 'java_not_ready':
      return 'Order is not ready to go out for delivery.';
    default:
      return 'Out for delivery was not changed.';
  }
}

export function forceProgressPickupCopy(tripStatus: string | undefined, riderName: string): string {
  const name = riderName.trim() || 'the assigned rider';
  if (tripStatus === 'assigned') {
    return `Accept this trip for ${name} and mark the order out for delivery? This completes pickup and sends the customer the OTP.`;
  }
  return `Mark this order out for delivery for ${name}? This completes pickup and sends the customer the OTP.`;
}

export function javaOnlyPickupCopy(): string {
  return 'Pickup is already done. This only updates the order to out for delivery.';
}

export function assignedDuringConfirmMessage(riderName: string): string {
  const name = riderName.trim() || 'another rider';
  return `This trip was just assigned to ${name}. Out for delivery was not changed. They will pick up normally.`;
}

export type PickupConfirmResult =
  | { ok: true }
  | { ok: false; kind: 'assign_lost'; message: string; preview: AdminDropPreview }
  | { ok: false; kind: 'assign_error'; message: string; preview: AdminDropPreview }
  | { ok: false; kind: 'pickup_error'; message: string; preview?: AdminDropPreview };

export async function runAdminPickupConfirm(input: {
  preview: AdminDropPreview;
  selectedPhone: string;
  assign: (phone: string) => Promise<void>;
  complete: () => Promise<void>;
  reload: () => Promise<AdminDropPreview>;
  errorMessage: (err: unknown) => string;
}): Promise<PickupConfirmResult> {
  if (input.preview.mode === 'pick_rider') {
    try {
      await input.assign(input.selectedPhone);
    } catch (err) {
      const preview = await input.reload();
      if (preview.mode === 'force_progress') {
        const name = preview.rider?.name || preview.rider?.phone || '';
        return {
          ok: false,
          kind: 'assign_lost',
          message: assignedDuringConfirmMessage(name),
          preview
        };
      }
      return { ok: false, kind: 'assign_error', message: input.errorMessage(err), preview };
    }
  } else if (input.preview.mode !== 'java_only' && input.preview.mode !== 'force_progress') {
    return {
      ok: false,
      kind: 'assign_error',
      message: 'Out for delivery was not changed.',
      preview: input.preview
    };
  }

  try {
    await input.complete();
  } catch (err) {
    let preview: AdminDropPreview | undefined;
    try {
      preview = await input.reload();
    } catch {
      preview = undefined;
    }
    return { ok: false, kind: 'pickup_error', message: input.errorMessage(err), preview };
  }
  return { ok: true };
}
