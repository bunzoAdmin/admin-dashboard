/**
 * Store-local time helpers for ops UI.
 *
 * Age / relative waiting time is the primary "is it stuck?" signal (timezone-agnostic).
 * Absolute timestamps are secondary context and always rendered in Africa/Lusaka (CAT).
 */

export const STORE_TIMEZONE = 'Africa/Lusaka';
export const STORE_TZ_LABEL = 'CAT';
/** CAT is fixed UTC+2 (no DST). Used for metrics day bucketing. */
export const STORE_UTC_OFFSET_MINUTES = 120;

/** Calendar date YYYY-MM-DD in store timezone. */
export function storeYmd(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });
}

/** UTC instant of midnight at the start of a store calendar day. */
export function storeDayStartInstant(iso: string): string {
  return new Date(`${iso}T00:00:00+02:00`).toISOString();
}

/** Store weekday 0=Sun … 6=Sat for a store calendar date. */
export function storeWeekday(iso: string): number {
  const noon = new Date(`${iso}T12:00:00+02:00`);
  const shortDay = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIMEZONE,
    weekday: 'short'
  }).format(noon);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(shortDay);
}

export function addStoreCalendarDays(iso: string, days: number): string {
  const t = new Date(`${iso}T12:00:00+02:00`).getTime() + days * 86_400_000;
  return storeYmd(new Date(t));
}

export function todayIsoStore(): string {
  return storeYmd(new Date());
}

/** Parse {@code datetime-local} input as store wall time (CAT) → UTC ISO instant. */
export function parseStoreDatetimeLocal(value: string): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalized}+02:00`).toISOString();
}

const storeDateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: STORE_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

/** Wall-clock in store timezone, e.g. "26 Jul 2026, 3:00 pm CAT". */
export function formatStoreDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${storeDateTimeFmt.format(d)} ${STORE_TZ_LABEL}`;
}

/** Compact store time for dense tables, e.g. "26 Jul, 3:00 pm CAT". */
export function formatStoreDateTimeShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TIMEZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${fmt.format(d)} ${STORE_TZ_LABEL}`;
}

/** Minutes since an ISO instant (client-side; matches backend ageMinutes semantics). */
export function ageMinutesSince(iso?: string | null, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 60_000));
}

/** Ops age display: "45m", "2h", "2h 15m". */
export function formatAgeMinutes(minutes?: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Relative label for recent events: "just now", "5m ago", "2h ago". */
export function formatWaitingLabel(minutes?: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 1) return 'just now';
  return `${formatAgeMinutes(minutes)} ago`;
}

export type AgeTone = 'muted' | 'ok' | 'watch' | 'urgent';

/**
 * Visual urgency for waiting time. Terminal orders (delivered/cancelled) stay muted —
 * age is history, not a call-to-action.
 */
export function ageUrgencyTone(
  minutes?: number | null,
  opts?: { terminal?: boolean }
): AgeTone {
  if (minutes == null || opts?.terminal) return 'muted';
  if (minutes >= 60) return 'urgent';
  if (minutes >= 30) return 'watch';
  return 'ok';
}

export function ageToneClass(tone: AgeTone): string {
  switch (tone) {
    case 'urgent':
      return 'font-semibold tabular-nums text-red-600';
    case 'watch':
      return 'font-semibold tabular-nums text-amber-600';
    case 'ok':
      return 'font-semibold tabular-nums text-gray-900';
    default:
      return 'tabular-nums text-gray-500';
  }
}

export function isTerminalOrderStatus(status?: string | null): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED';
}
