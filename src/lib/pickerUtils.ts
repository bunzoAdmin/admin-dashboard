import type { PickTaskStatus, PickerStatus } from './pickerTypes';
import { formatStoreDateTimeShort } from './storeTime';

type BadgeTone = 'gray' | 'green' | 'amber' | 'red' | 'blue';

export function pickerStatusTone(status: string): BadgeTone {
  switch (status as PickerStatus) {
    case 'AVAILABLE':
      return 'green';
    case 'PICKING':
      return 'blue';
    case 'ON_BREAK':
      return 'amber';
    default:
      return 'gray';
  }
}

export function taskStatusTone(status: string): BadgeTone {
  switch (status as PickTaskStatus) {
    case 'ASSIGNED':
      return 'amber';
    case 'IN_PROGRESS':
      return 'blue';
    case 'PICKED':
      return 'green';
    case 'CANCELLED':
      return 'red';
    default:
      return 'gray';
  }
}

export function formatPickerStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a duration in seconds as human-readable text, e.g. "6 sec", "1 min 7 sec". */
export function formatDurationSeconds(totalSeconds?: number | null): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—';
  const sec = Math.round(totalSeconds);
  if (sec < 60) return `${sec} sec`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (rem === 0) return `${mins} min`;
  return `${mins} min ${rem} sec`;
}

export function formatTime(iso?: string | null): string {
  return formatStoreDateTimeShort(iso);
}

export function formatShiftTime(t: string): string {
  if (!t) return '—';
  const parts = t.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return t;
}
