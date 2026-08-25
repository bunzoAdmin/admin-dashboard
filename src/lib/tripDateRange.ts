import { addStoreCalendarDays, todayIsoStore } from '@/lib/storeTime';

export const TRIP_MAX_CUSTOM_RANGE_DAYS = 7;

export type TripRangePreset = 'today' | 'last7' | 'custom';

export function resolveTripRange(
  preset: TripRangePreset,
  customFrom: string,
  customTo: string
): { from: string; to: string } | null {
  const today = todayIsoStore();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'last7') return { from: addStoreCalendarDays(today, -6), to: today };
  if (!customFrom || !customTo) return null;
  return { from: customFrom, to: customTo };
}

export function tripRangeError(
  preset: TripRangePreset,
  customFrom: string,
  customTo: string
): string | null {
  if (preset !== 'custom') return null;
  if (!customFrom || !customTo) return 'Pick a from and to date.';
  if (customTo < customFrom) return '"To" date must be on or after "from" date.';
  const spanDays =
    Math.round(
      (new Date(`${customTo}T00:00:00Z`).getTime() - new Date(`${customFrom}T00:00:00Z`).getTime()) /
        86_400_000
    ) + 1;
  if (spanDays > TRIP_MAX_CUSTOM_RANGE_DAYS) {
    return `Custom range can span at most ${TRIP_MAX_CUSTOM_RANGE_DAYS} days.`;
  }
  return null;
}
