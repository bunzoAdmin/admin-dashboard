import {
  addStoreCalendarDays,
  parseStoreDatetimeLocal,
  storeDayStartInstant,
  todayIsoStore
} from '@/lib/storeTime';

export type OrderDatePreset =
  | 'all'
  | 'last1h'
  | 'last3h'
  | 'last6h'
  | 'last12h'
  | 'today'
  | 'last24h'
  | 'last7d'
  | 'custom';

export type OrderDateRange = { dateFrom?: string; dateTo?: string };

export const ORDER_DATE_PRESET_GROUPS: { label: string; options: { value: OrderDatePreset; label: string }[] }[] = [
  {
    label: 'Quick',
    options: [
      { value: 'last1h', label: 'Last 1 hour' },
      { value: 'last3h', label: 'Last 3 hours' },
      { value: 'last6h', label: 'Last 6 hours' },
      { value: 'last12h', label: 'Last 12 hours' }
    ]
  },
  {
    label: 'Days',
    options: [
      { value: 'today', label: 'Today (CAT)' },
      { value: 'last24h', label: 'Last 24 hours' },
      { value: 'last7d', label: 'Last 7 days' }
    ]
  },
  {
    label: 'Other',
    options: [
      { value: 'all', label: 'All time' },
      { value: 'custom', label: 'Custom range' }
    ]
  }
];

function rollingHours(hours: number, nowMs = Date.now()): OrderDateRange {
  return {
    dateFrom: new Date(nowMs - hours * 3_600_000).toISOString(),
    dateTo: new Date(nowMs).toISOString()
  };
}

function storeTodayRange(): OrderDateRange {
  const today = todayIsoStore();
  return {
    dateFrom: storeDayStartInstant(today),
    dateTo: new Date(`${addStoreCalendarDays(today, 1)}T00:00:00+02:00`).toISOString()
  };
}

function storeLast7DaysRange(nowMs = Date.now()): OrderDateRange {
  const today = todayIsoStore();
  return {
    dateFrom: storeDayStartInstant(addStoreCalendarDays(today, -6)),
    dateTo: new Date(nowMs).toISOString()
  };
}

export function resolveOrderDateRange(
  preset: OrderDatePreset,
  customFrom: string,
  customTo: string,
  nowMs = Date.now()
): OrderDateRange {
  switch (preset) {
    case 'last1h':
      return rollingHours(1, nowMs);
    case 'last3h':
      return rollingHours(3, nowMs);
    case 'last6h':
      return rollingHours(6, nowMs);
    case 'last12h':
      return rollingHours(12, nowMs);
    case 'today':
      return storeTodayRange();
    case 'last24h':
      return rollingHours(24, nowMs);
    case 'last7d':
      return storeLast7DaysRange(nowMs);
    case 'custom':
      return {
        dateFrom: customFrom ? parseStoreDatetimeLocal(customFrom) : undefined,
        dateTo: customTo ? parseStoreDatetimeLocal(customTo) : undefined
      };
    default:
      return {};
  }
}
