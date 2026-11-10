import type { DriverTripItem } from './types';

/** Whole minutes for a last-mile / return duration, or a dash when unreliable. */
export function formatTripMinutes(minutes: number | null | undefined): string {
  return minutes == null ? '—' : `${Math.round(minutes)} min`;
}

/** Tooltip explaining why a trip's timing is blank, if it is. */
export function tripTimingNote(item: Pick<DriverTripItem, 'missing_arrival' | 'return_min'>): string | undefined {
  if (item.missing_arrival) return "Driver didn't mark arrived";
  if (item.return_min == null) return 'No return scan recorded';
  return undefined;
}

export function isInactiveTripStatus(status: string | undefined | null): boolean {
  return status === 'inactive';
}

/** Badge copy. `inactive` is superseded, not customer-cancelled and not completed. */
export function tripStatusLabel(status: string): string {
  if (status === 'inactive') return 'Inactive';
  return status.replace(/_/g, ' ');
}

export function tripStatusTone(status: string): 'gray' | 'amber' | 'blue' | 'green' | 'red' {
  switch (status) {
    case 'assigned':
      return 'amber';
    case 'accepted':
      return 'blue';
    case 'out_for_delivery':
      return 'green';
    case 'cancelled':
      return 'red';
    case 'inactive':
      return 'gray';
    default:
      return 'gray';
  }
}

/** Empty payout must not be shown as paid. qcom omits payout on inactive trips. */
export function tripPayoutDisplay(payoutZmw: number | null | undefined): string | null {
  if (payoutZmw == null) return null;
  return String(payoutZmw);
}
