export type LegId =
  | 'created_to_confirmed'
  | 'confirmed_to_pick_start'
  | 'pick_start_to_pick_end'
  | 'pick_end_to_ofd'
  | 'ofd_to_reached'
  | 'reached_to_delivered';

export const LEG_IDS: LegId[] = [
  'created_to_confirmed',
  'confirmed_to_pick_start',
  'pick_start_to_pick_end',
  'pick_end_to_ofd',
  'ofd_to_reached',
  'reached_to_delivered'
];

export type Tone = 'ok' | 'absurd' | 'preposterous';

export const LEG_THRESHOLDS = {
  created_to_confirmed: { ok: 60, absurd: 180 },
  confirmed_to_pick_start: { ok: 120, absurd: 300 },
  pick_end_to_ofd: { ok: 120, absurd: 300 },
  reached_to_delivered: { ok: 180, absurd: 480 }
} as const;

export type OrderEventLike = { toStatus?: string | null; occurredAt: string };
export type PickTaskLike = { startedAt?: string | null; completedAt?: string | null };
export type TripLike = { order_id: string; distance_km: number; reached_at?: string; trip_status: string };
export type OrderLike = {
  orderNumber: string;
  status: string;
  createdAt: string;
  items?: Array<{ orderedQuantity?: number | null }>;
};

export type BuiltLeg = {
  id: LegId;
  actualSeconds: number | null;
  tone: Tone | null;
};

export type OrderLegRow = {
  orderNumber: string;
  status: string;
  createdAt: string;
  units: number;
  distanceKm: number | null;
  legs: BuiltLeg[];
  itemPredictedMinutes: number;
  lastMilePredictedMinutes: number | null;
  predictedE2eMinutes: number | null;
  actualE2eSeconds: number | null;
  e2eTone: Tone | null;
  hasRed: boolean;
};

export type LegPred = {
  itemMinutes: number;
  lastMileMinutes: number | null;
  predictedE2eMinutes: number | null;
};

export function itemPredictedMinutes(units: number): number {
  if (units <= 0) return 0;
  return Math.ceil(units / 5);
}

export function lastMilePredictedMinutes(distanceKm: number | null | undefined): number | null {
  if (distanceKm == null) return null;
  return distanceKm * 2;
}

export function predictedE2eMinutes(itemMin: number, lastMileMin: number | null): number | null {
  if (lastMileMin == null) return null;
  return itemMin + lastMileMin;
}

export function formatDurationMmSs(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return '—';
  const s = Math.round(totalSeconds);
  if (s >= 3600) {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${pad2(seconds)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function predictedTone(actualSeconds: number, predictedMinutes: number | null | undefined): Tone | null {
  if (predictedMinutes == null) return null;
  const floor = Math.max(predictedMinutes * 60, 60);
  if (actualSeconds <= floor) return 'ok';
  if (actualSeconds <= 2 * floor) return 'absurd';
  return 'preposterous';
}

function absoluteTone(actualSeconds: number, caps: { ok: number; absurd: number }): Tone {
  if (actualSeconds <= caps.ok) return 'ok';
  if (actualSeconds <= caps.absurd) return 'absurd';
  return 'preposterous';
}

export function legTone(legId: LegId, actualSeconds: number | null, pred: LegPred): Tone | null {
  if (actualSeconds == null) return null;
  if (legId === 'pick_start_to_pick_end') {
    return predictedTone(actualSeconds, pred.itemMinutes);
  }
  if (legId === 'ofd_to_reached') {
    return predictedTone(actualSeconds, pred.lastMileMinutes);
  }
  const caps = LEG_THRESHOLDS[legId as keyof typeof LEG_THRESHOLDS];
  return absoluteTone(actualSeconds, caps);
}

export function e2eTone(
  actualSeconds: number | null | undefined,
  predictedE2eMin: number | null | undefined
): Tone | null {
  if (actualSeconds == null) return null;
  return predictedTone(actualSeconds, predictedE2eMin);
}

function firstEventAt(events: OrderEventLike[], status: string): string | null {
  const match = events.find((event) => event.toStatus === status);
  return match?.occurredAt ?? null;
}

function diffSeconds(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const start = Date.parse(a);
  const end = Date.parse(b);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 1000);
}

function sumUnits(items: OrderLike['items']): number {
  return (items ?? []).reduce((sum, item) => sum + (item.orderedQuantity ?? 0), 0);
}

function isInFlight(status: string): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

export function buildOrderLegRow(input: {
  order: OrderLike;
  events: OrderEventLike[];
  pick: PickTaskLike | null;
  trip: TripLike | null;
  nowMs: number;
}): OrderLegRow {
  const { order, events, pick, trip, nowMs } = input;
  const units = sumUnits(order.items);
  const distanceKm = trip == null ? null : trip.distance_km;
  const itemMin = itemPredictedMinutes(units);
  const lastMileMin = lastMilePredictedMinutes(distanceKm);
  const predE2e = predictedE2eMinutes(itemMin, lastMileMin);
  const pred: LegPred = {
    itemMinutes: itemMin,
    lastMileMinutes: lastMileMin,
    predictedE2eMinutes: predE2e
  };

  const createdAt = order.createdAt;
  const confirmedAt = firstEventAt(events, 'CONFIRMED');
  const pickStartedAt = pick?.startedAt ?? null;
  const pickCompletedAt = pick?.completedAt ?? null;
  const ofdAt = firstEventAt(events, 'OUT_FOR_DELIVERY');
  const reachedAt = trip?.reached_at || null;
  const deliveredAt = firstEventAt(events, 'DELIVERED');

  const starts: Record<LegId, string | null> = {
    created_to_confirmed: createdAt,
    confirmed_to_pick_start: confirmedAt,
    pick_start_to_pick_end: pickStartedAt,
    pick_end_to_ofd: pickCompletedAt,
    ofd_to_reached: ofdAt,
    reached_to_delivered: reachedAt
  };

  const ends: Record<LegId, string | null> = {
    created_to_confirmed: confirmedAt,
    confirmed_to_pick_start: pickStartedAt,
    pick_start_to_pick_end: pickCompletedAt,
    pick_end_to_ofd: ofdAt,
    ofd_to_reached: reachedAt,
    reached_to_delivered: deliveredAt
  };

  const legs: BuiltLeg[] = LEG_IDS.map((id) => ({
    id,
    actualSeconds: diffSeconds(starts[id], ends[id]),
    tone: null
  }));

  if (isInFlight(order.status)) {
    const nowIso = new Date(nowMs).toISOString();
    const open = legs.find((leg) => leg.actualSeconds == null && starts[leg.id]);
    if (open) {
      open.actualSeconds = diffSeconds(starts[open.id], nowIso);
    }
  }

  for (const leg of legs) {
    leg.tone = legTone(leg.id, leg.actualSeconds, pred);
  }

  const actualE2eSeconds = actualE2e(order.status, createdAt, deliveredAt, nowMs, starts, ends);
  const e2e = e2eTone(actualE2eSeconds, predE2e);
  const hasRed = e2e === 'preposterous' || legs.some((leg) => leg.tone === 'preposterous');

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    units,
    distanceKm,
    legs,
    itemPredictedMinutes: itemMin,
    lastMilePredictedMinutes: lastMileMin,
    predictedE2eMinutes: predE2e,
    actualE2eSeconds,
    e2eTone: e2e,
    hasRed
  };
}

function actualE2e(
  status: string,
  createdAt: string,
  deliveredAt: string | null,
  nowMs: number,
  starts: Record<LegId, string | null>,
  ends: Record<LegId, string | null>
): number | null {
  if (status === 'DELIVERED') {
    return diffSeconds(createdAt, deliveredAt);
  }
  if (isInFlight(status)) {
    return diffSeconds(createdAt, new Date(nowMs).toISOString());
  }

  let lastCompleted: string | null = null;
  for (const id of LEG_IDS) {
    if (diffSeconds(starts[id], ends[id]) != null && ends[id]) {
      lastCompleted = ends[id];
    }
  }
  return lastCompleted ? diffSeconds(createdAt, lastCompleted) : null;
}
