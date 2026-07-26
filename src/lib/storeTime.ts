/**
 * Store-local time helpers for ops UI.
 *
 * Age / relative waiting time is the primary "is it stuck?" signal (timezone-agnostic).
 * Absolute timestamps are secondary context and always rendered in Africa/Lusaka (CAT).
 */

export const STORE_TIMEZONE = 'Africa/Lusaka';
export const STORE_TZ_LABEL = 'CAT';

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
