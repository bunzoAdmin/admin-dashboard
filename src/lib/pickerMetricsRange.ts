import type { PickerAnalyticsPeriod } from './pickerTypes';

/** Minutes east of UTC (IST = 330). Matches MySQL DATE_ADD offset. */
export function localUtcOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

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

export function todayIsoLocal(): string {
  return toIsoDate(new Date());
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfLocalWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  return startOfLocalDay(addLocalDays(d, diff));
}

function startOfLocalMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfLocalMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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
  const utcOffsetMinutes = localUtcOffsetMinutes();
  const { period } = opts;

  if (period === 'CUSTOM') {
    const fromDay = startOfLocalDay(parseIsoDateLocal(opts.customFrom));
    const toDay = startOfLocalDay(parseIsoDateLocal(opts.customTo));
    if (toDay < fromDay) {
      throw new Error('End date must be on or after start date');
    }
    const days = Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000) + 1;
    if (days > 366) {
      throw new Error('Custom range cannot exceed 366 days');
    }
    const toExclusive = startOfLocalDay(addLocalDays(toDay, 1));
    const calendarFrom = toIsoDate(fromDay);
    const calendarTo = toIsoDate(toDay);
    return {
      period,
      from: fromDay.toISOString(),
      toExclusive: toExclusive.toISOString(),
      calendarFrom,
      calendarTo,
      label: calendarFrom === calendarTo
        ? formatDayLabel(fromDay)
        : `${formatDayLabel(fromDay)} – ${formatDayLabel(toDay)}`,
      utcOffsetMinutes
    };
  }

  const anchor = parseIsoDateLocal(opts.anchorDate);

  if (period === 'DAY') {
    const fromDay = startOfLocalDay(anchor);
    const toExclusive = startOfLocalDay(addLocalDays(fromDay, 1));
    const calendarFrom = toIsoDate(fromDay);
    return {
      period,
      from: fromDay.toISOString(),
      toExclusive: toExclusive.toISOString(),
      calendarFrom,
      calendarTo: calendarFrom,
      label: formatDayLabel(fromDay),
      utcOffsetMinutes
    };
  }

  if (period === 'WEEK') {
    const weekStart = startOfLocalWeekMonday(anchor);
    const weekEnd = addLocalDays(weekStart, 6);
    const toExclusive = startOfLocalDay(addLocalDays(weekStart, 7));
    return {
      period,
      from: weekStart.toISOString(),
      toExclusive: toExclusive.toISOString(),
      calendarFrom: toIsoDate(weekStart),
      calendarTo: toIsoDate(weekEnd),
      label: `${formatDayLabel(weekStart)} – ${formatDayLabel(weekEnd)}`,
      utcOffsetMinutes
    };
  }

  // MONTH
  const monthStart = startOfLocalMonth(anchor);
  const monthEnd = endOfLocalMonth(anchor);
  const toExclusive = startOfLocalDay(addLocalDays(startOfLocalDay(monthEnd), 1));
  return {
    period,
    from: monthStart.toISOString(),
    toExclusive: toExclusive.toISOString(),
    calendarFrom: toIsoDate(monthStart),
    calendarTo: toIsoDate(monthEnd),
    label: formatMonthLabel(monthStart),
    utcOffsetMinutes
  };
}

/** Shift the anchor by one period unit (day/week/month). */
export function nudgeAnchorDate(iso: string, period: PickerAnalyticsPeriod, direction: -1 | 1): string {
  const d = parseIsoDateLocal(iso);
  if (period === 'WEEK') {
    return toIsoDate(addLocalDays(d, direction * 7));
  }
  if (period === 'MONTH') {
    return toIsoDate(new Date(d.getFullYear(), d.getMonth() + direction, 1, 12, 0, 0, 0));
  }
  return toIsoDate(addLocalDays(d, direction));
}
