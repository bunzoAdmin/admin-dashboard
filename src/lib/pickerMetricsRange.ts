import type { PickerAnalyticsPeriod } from './pickerTypes';
import {
  STORE_UTC_OFFSET_MINUTES,
  addStoreCalendarDays,
  storeDayStartInstant,
  storeWeekday,
  storeYmd,
  todayIsoStore
} from './storeTime';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** @deprecated Use todayIsoStore — metrics use store calendar (CAT), not browser local. */
export function todayIsoLocal(): string {
  return todayIsoStore();
}

function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatMonthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m - 1, 1, 12).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
}

function startOfStoreWeekMonday(iso: string): string {
  const wd = storeWeekday(iso);
  const diff = wd === 0 ? -6 : 1 - wd;
  return addStoreCalendarDays(iso, diff);
}

function startOfStoreMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${y}-${m}-01`;
}

function endOfStoreMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(lastDay)}`;
}

export interface ResolvedLocalRange {
  period: PickerAnalyticsPeriod;
  from: string; // Instant ISO
  toExclusive: string; // Instant ISO
  calendarFrom: string;
  calendarTo: string;
  label: string;
  utcOffsetMinutes: number;
}

export function resolveLocalMetricsRange(opts: {
  period: PickerAnalyticsPeriod;
  anchorDate: string;
  customFrom: string;
  customTo: string;
}): ResolvedLocalRange {
  const utcOffsetMinutes = STORE_UTC_OFFSET_MINUTES;
  const { period } = opts;

  if (period === 'CUSTOM') {
    const calendarFrom = opts.customFrom;
    const calendarTo = opts.customTo;
    if (calendarTo < calendarFrom) {
      throw new Error('End date must be on or after start date');
    }
    const fromDay = calendarFrom;
    const toDay = calendarTo;
    const fromMs = new Date(storeDayStartInstant(fromDay)).getTime();
    const toMs = new Date(storeDayStartInstant(addStoreCalendarDays(toDay, 1))).getTime();
    const days = Math.round((toMs - fromMs) / 86_400_000);
    if (days > 366) {
      throw new Error('Custom range cannot exceed 366 days');
    }
    const toExclusive = storeDayStartInstant(addStoreCalendarDays(toDay, 1));
    return {
      period,
      from: storeDayStartInstant(fromDay),
      toExclusive,
      calendarFrom,
      calendarTo,
      label: calendarFrom === calendarTo
        ? formatDayLabel(fromDay)
        : `${formatDayLabel(fromDay)} – ${formatDayLabel(toDay)}`,
      utcOffsetMinutes
    };
  }

  const anchor = opts.anchorDate;

  if (period === 'DAY') {
    const calendarFrom = anchor;
    return {
      period,
      from: storeDayStartInstant(calendarFrom),
      toExclusive: storeDayStartInstant(addStoreCalendarDays(calendarFrom, 1)),
      calendarFrom,
      calendarTo: calendarFrom,
      label: formatDayLabel(calendarFrom),
      utcOffsetMinutes
    };
  }

  if (period === 'WEEK') {
    const weekStart = startOfStoreWeekMonday(anchor);
    const weekEnd = addStoreCalendarDays(weekStart, 6);
    return {
      period,
      from: storeDayStartInstant(weekStart),
      toExclusive: storeDayStartInstant(addStoreCalendarDays(weekStart, 7)),
      calendarFrom: weekStart,
      calendarTo: weekEnd,
      label: `${formatDayLabel(weekStart)} – ${formatDayLabel(weekEnd)}`,
      utcOffsetMinutes
    };
  }

  // MONTH
  const monthStart = startOfStoreMonth(anchor);
  const monthEnd = endOfStoreMonth(anchor);
  return {
    period,
    from: storeDayStartInstant(monthStart),
    toExclusive: storeDayStartInstant(addStoreCalendarDays(monthEnd, 1)),
    calendarFrom: monthStart,
    calendarTo: monthEnd,
    label: formatMonthLabel(monthStart),
    utcOffsetMinutes
  };
}

/** Shift the anchor by one period unit (day/week/month) in store calendar. */
export function nudgeAnchorDate(iso: string, period: PickerAnalyticsPeriod, direction: -1 | 1): string {
  if (period === 'WEEK') {
    return addStoreCalendarDays(iso, direction * 7);
  }
  if (period === 'MONTH') {
    const [y, m] = iso.split('-').map(Number);
    const absolute = y * 12 + (m - 1) + direction;
    const ny = Math.floor(absolute / 12);
    const nm = (absolute % 12) + 1;
    return `${ny}-${pad(nm)}-01`;
  }
  return addStoreCalendarDays(iso, direction);
}
