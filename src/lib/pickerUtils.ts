import type { PickTaskStatus, PickerStatus } from './pickerTypes';

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

export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatShiftTime(t: string): string {
  if (!t) return '—';
  const parts = t.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return t;
}
