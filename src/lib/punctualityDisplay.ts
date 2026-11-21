export type PunctualityTone = 'green' | 'red' | 'neutral';

const ZAMBIA_TZ = 'Africa/Lusaka';

export function zambiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZAMBIA_TZ }).format(now);
}

export interface RiderListPunctualityInput {
  shiftStart?: string | null;
  lastScoredDate?: string | null;
  lastScoredMinutes?: number | null;
  openMinutes?: number | null;
  today: string;
}

export interface RiderListPunctuality {
  today: string;
  todayTone: PunctualityTone;
  open: string;
  openTone: PunctualityTone;
}

/** Signed minutes as +1h 20m, −25m, or 0. Positive is early. */
export function formatSignedMinutes(minutes: number): string {
  if (minutes === 0) return '0';
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours && mins) return `${sign}${hours}h ${mins}m`;
  if (hours) return `${sign}${hours}h`;
  return `${sign}${mins}m`;
}

export function dayStartLabel(row: { scored: boolean; signed_minutes: number }): string {
  if (!row.scored) return 'Not scanned';
  return formatSignedMinutes(row.signed_minutes);
}

/** Clock shown on every Presence row, including one that is not scored yet. */
export function presenceRowStart(row: { shift_start?: string | null }): string {
  return (row.shift_start ?? '').trim();
}

/** Shown under This day when the selected day has no shift starts. */
export function noShiftStartMessage(rowCount: number): string {
  return rowCount === 0 ? 'There is no shift start.' : '';
}

export function punctualityTone(minutes: number): PunctualityTone {
  if (minutes > 0) return 'green';
  if (minutes < 0) return 'red';
  return 'neutral';
}

export function canClearPunctuality(openMinutes: number): boolean {
  return openMinutes !== 0;
}

/** Hours and minutes toward zero, not past it. Minutes are 0–59. */
export function canClearAmount(openMinutes: number, hours: number, minutes: number): boolean {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  if (hours < 0 || minutes < 0 || minutes > 59) return false;
  const amount = hours * 60 + minutes;
  if (amount === 0 || openMinutes === 0) return false;
  return amount <= Math.abs(openMinutes);
}

/** The signed minutes a valid amount takes off the open total. */
export function signedClearAmount(openMinutes: number, hours: number, minutes: number): number {
  const amount = hours * 60 + minutes;
  return openMinutes < 0 ? -amount : amount;
}

/** Saved start times, earliest first. A legacy single time is the list of one. */
export function listedShiftStarts(starts?: string[] | null, legacy?: string | null): string[] {
  const list = (starts ?? []).map((start) => start.trim()).filter(Boolean);
  if (list.length > 0) return [...list].sort();
  const one = legacy?.trim();
  return one ? [one] : [];
}

/** The last remaining start can be replaced and cannot be removed. */
export function canRemoveShiftStart(count: number): boolean {
  return count > 1;
}

export function punctualityClass(tone: PunctualityTone): string {
  if (tone === 'green') return 'text-green-700';
  if (tone === 'red') return 'text-red-600';
  return 'text-gray-500';
}

/** Today and the open aggregate for one rider on the darkstore list. */
export function riderListPunctuality(input: RiderListPunctualityInput): RiderListPunctuality {
  if (!input.shiftStart?.trim()) {
    return { today: '—', todayTone: 'neutral', open: '—', openTone: 'neutral' };
  }
  const openMinutes = input.openMinutes ?? 0;
  const scoredToday = input.lastScoredDate === input.today;
  const todayMinutes = input.lastScoredMinutes ?? 0;
  return {
    today: scoredToday ? formatSignedMinutes(todayMinutes) : 'Not scanned',
    todayTone: scoredToday ? punctualityTone(todayMinutes) : 'neutral',
    open: formatSignedMinutes(openMinutes),
    openTone: punctualityTone(openMinutes)
  };
}
