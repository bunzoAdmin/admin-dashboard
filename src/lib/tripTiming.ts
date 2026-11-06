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
