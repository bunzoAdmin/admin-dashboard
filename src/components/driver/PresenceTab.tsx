'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { PresenceEndReason, PresenceResponse, PresenceSegment } from '@/lib/types';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Stat } from '@/components/ui';

const ZAMBIA_TZ = 'Africa/Lusaka';
const DAY_MINUTES = 24 * 60;

// Today's date (YYYY-MM-DD) in Zambia local time — the presence day boundary.
function zambiaToday(): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZAMBIA_TZ }).format(new Date());
}

// Current wall-clock minute-of-day in Zambia (used to cap a still-open segment).
function zambiaNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZAMBIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

function parseHHMM(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

// "412" -> "6h 52m"; "45" -> "45m"; "120" -> "2h".
function formatMinutes(total: number): string {
  if (!total || total <= 0) return '0m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function minutesToHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface ReasonStyle {
  label: string;
  tone: 'gray' | 'green' | 'amber' | 'red' | 'blue';
  bar: string;
}

const REASON_STYLES: Record<PresenceEndReason, ReasonStyle> = {
  ended_duty: { label: 'ended duty', tone: 'green', bar: 'bg-brand-green' },
  missed_scan: { label: 'missed scan', tone: 'amber', bar: 'bg-amber-500' },
  cancelled: { label: 'cancelled', tone: 'red', bar: 'bg-red-500' },
  ongoing: { label: 'ongoing', tone: 'blue', bar: 'bg-blue-500' },
  '': { label: 'ongoing', tone: 'blue', bar: 'bg-blue-500' }
};

interface ResolvedSegment {
  raw: PresenceSegment;
  startMin: number;
  endMin: number;
  ongoing: boolean;
  style: ReasonStyle;
}

// Turns raw API segments into positionable minute ranges, dropping unparseable rows
// and treating empty/"ongoing" end as open (capped at "now" for today).
function resolveSegments(res: PresenceResponse, isToday: boolean): ResolvedSegment[] {
  const nowMin = zambiaNowMinutes();
  const out: ResolvedSegment[] = [];
  for (const raw of res.segments ?? []) {
    const startMin = parseHHMM(raw.start);
    if (startMin === null) continue;
    const parsedEnd = parseHHMM(raw.end);
    const reason: PresenceEndReason = raw.end_reason || '';
    const ongoing = parsedEnd === null || reason === 'ongoing' || reason === '';
    const endMin = ongoing ? (isToday ? Math.max(startMin, nowMin) : DAY_MINUTES) : Math.max(startMin, parsedEnd ?? startMin);
    out.push({
      raw,
      startMin,
      endMin,
      ongoing,
      style: REASON_STYLES[ongoing ? 'ongoing' : reason] ?? REASON_STYLES['']
    });
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}

export function PresenceTab({ phone }: { phone: string }) {
  const [date, setDate] = useState<string>(() => zambiaToday());
  const [data, setData] = useState<PresenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDriverPresence(phone, date));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load presence.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [phone, date]);

  useEffect(() => {
    load();
  }, [load]);

  const isToday = date === zambiaToday();
  const segments = useMemo(() => (data ? resolveSegments(data, isToday) : []), [data, isToday]);

  // Axis window: snap to the hour around the active range so segments are readable;
  // fall back to a daytime window when there's nothing to show.
  const window = useMemo(() => {
    if (segments.length === 0) return { start: 6 * 60, end: 22 * 60 };
    const minStart = Math.min(...segments.map((s) => s.startMin));
    const maxEnd = Math.max(...segments.map((s) => s.endMin));
    let start = Math.floor(minStart / 60) * 60;
    let end = Math.ceil(maxEnd / 60) * 60;
    if (end - start < 180) end = Math.min(DAY_MINUTES, start + 180); // keep a minimum span
    if (end === start) end = start + 60;
    start = Math.max(0, start);
    end = Math.min(DAY_MINUTES, end);
    return { start, end };
  }, [segments]);

  const ticks = useMemo(() => {
    const span = window.end - window.start;
    const spanHours = span / 60;
    const stepH = spanHours <= 6 ? 1 : spanHours <= 12 ? 2 : 3;
    const step = stepH * 60;
    const first = Math.ceil(window.start / step) * step;
    const list: number[] = [];
    for (let t = first; t <= window.end; t += step) list.push(t);
    return list;
  }, [window]);

  const pct = useCallback(
    (min: number) => {
      const span = window.end - window.start || 1;
      return ((Math.max(window.start, Math.min(window.end, min)) - window.start) / span) * 100;
    },
    [window]
  );

  const missedScans = segments.filter((s) => s.raw.end_reason === 'missed_scan').length;
  const stores = Array.from(new Set(segments.map((s) => s.raw.store_id).filter(Boolean)));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field label="Date (Zambia time)" className="w-48">
            <input
              className="input"
              type="date"
              value={date}
              max={zambiaToday()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {!isToday && (
            <button type="button" className="btn-ghost" onClick={() => setDate(zambiaToday())}>
              Today
            </button>
          )}
        </div>
      </Card>

      {loading && <Loading label="Loading presence…" />}
      {error && !loading && <ErrorBox message={error} />}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total online time" value={formatMinutes(data.total_online_minutes)} sub={`${date}${isToday ? ' · today' : ''}`} />
            <Stat label="Online segments" value={segments.length} sub={segments.length ? 'runs of activity' : undefined} />
            <Stat
              label="Missed scans"
              value={missedScans}
              sub={missedScans ? 'auto-offline flips' : 'none'}
            />
            <Stat label="Store" value={stores.length ? stores.join(', ') : '—'} />
          </div>

          {segments.length === 0 ? (
            <Card>
              <EmptyState>No presence recorded on {date}. The rider was offline all day.</EmptyState>
            </Card>
          ) : (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Timeline</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <LegendDot className="bg-brand-green" label="ended duty" />
                  <LegendDot className="bg-amber-500" label="missed scan" />
                  <LegendDot className="bg-red-500" label="cancelled" />
                  <LegendDot className="bg-blue-500" label="ongoing" />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-sm bg-gray-200" /> offline / gap
                  </span>
                </div>
              </div>

              {/* Track: the gray background is offline time; colored blocks are online runs. */}
              <div className="relative h-12 w-full overflow-hidden rounded-lg bg-gray-100">
                {ticks.map((t) => (
                  <div
                    key={`grid-${t}`}
                    className="absolute top-0 h-full w-px bg-white/70"
                    style={{ left: `${pct(t)}%` }}
                  />
                ))}
                {segments.map((s, i) => {
                  const left = pct(s.startMin);
                  const width = Math.max(0.6, pct(s.endMin) - left);
                  const end = s.ongoing ? 'now' : s.raw.end;
                  return (
                    <div
                      key={`${s.raw.start}-${i}`}
                      className={`group absolute top-1 bottom-1 rounded-sm ${s.style.bar} ${
                        s.ongoing ? 'animate-pulse' : ''
                      } cursor-default ring-1 ring-black/5 transition hover:brightness-110`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${s.raw.start}–${end} · ${s.style.label}${s.raw.store_id ? ` · store ${s.raw.store_id}` : ''}`}
                    >
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                        {s.raw.start}–{end} · {s.style.label}
                        {s.raw.store_id ? ` · store ${s.raw.store_id}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hour axis */}
              <div className="relative mt-1 h-4 w-full">
                {ticks.map((t) => (
                  <span
                    key={`tick-${t}`}
                    className="absolute -translate-x-1/2 text-[10px] tabular-nums text-gray-400"
                    style={{ left: `${pct(t)}%` }}
                  >
                    {minutesToHHMM(t)}
                  </span>
                ))}
              </div>

              {/* Per-segment breakdown */}
              <div className="mt-5 divide-y divide-gray-50 border-t border-gray-100 text-sm">
                {segments.map((s, i) => {
                  const dur = Math.max(0, s.endMin - s.startMin);
                  const end = s.ongoing ? 'now' : s.raw.end;
                  return (
                    <div key={`row-${s.raw.start}-${i}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.style.bar}`} />
                        <span className="font-mono text-xs tabular-nums text-gray-700">
                          {s.raw.start} – {end}
                        </span>
                        <span className="text-xs text-gray-400">{formatMinutes(dur)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.raw.store_id && <span className="text-xs text-gray-400">store {s.raw.store_id}</span>}
                        <Badge tone={s.style.tone}>{s.style.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} /> {label}
    </span>
  );
}
