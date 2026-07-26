'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Calendar, ChevronLeft, ChevronRight, RefreshCw, Users } from 'lucide-react';
import clsx from 'clsx';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { PickerAnalyticsPeriod, PickerAnalyticsResponse } from '@/lib/pickerTypes';
import { nudgeAnchorDate, resolveLocalMetricsRange, todayIsoLocal } from '@/lib/pickerMetricsRange';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Card, EmptyState, ErrorBox, Loading, Stat } from '@/components/ui';

const PERIODS: { id: PickerAnalyticsPeriod; label: string; hint: string }[] = [
  { id: 'DAY', label: 'Day', hint: 'Your local calendar day' },
  { id: 'WEEK', label: 'Week', hint: 'Mon–Sun in your local timezone' },
  { id: 'MONTH', label: 'Month', hint: 'Full local calendar month' },
  { id: 'CUSTOM', label: 'Custom', hint: 'Any local date range' }
];

function fmtMinutes(v?: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}m`;
}

function fmtDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export default function PickerMetricsPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [period, setPeriod] = useState<PickerAnalyticsPeriod>('DAY');
  const [anchorDate, setAnchorDate] = useState(todayIsoLocal);
  const [fromDate, setFromDate] = useState(todayIsoLocal);
  const [toDate, setToDate] = useState(todayIsoLocal);
  const [data, setData] = useState<PickerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const range = resolveLocalMetricsRange({
        period,
        anchorDate,
        customFrom: fromDate,
        customTo: toDate
      });
      setData(
        await pickerApi.getAnalytics(storeId, {
          period: range.period,
          from: range.from,
          toExclusive: range.toExclusive,
          label: range.label,
          calendarFrom: range.calendarFrom,
          calendarTo: range.calendarTo,
          utcOffsetMinutes: range.utcOffsetMinutes
        })
      );
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : err instanceof Error ? err.message : 'Failed to load metrics.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [storeId, period, anchorDate, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const trendMax = useMemo(() => {
    if (!data?.dailyTrend.length) return 1;
    return Math.max(1, ...data.dailyTrend.map((d) => d.completedTasks));
  }, [data]);

  function nudge(direction: -1 | 1) {
    setAnchorDate((d) => nudgeAnchorDate(d, period === 'CUSTOM' ? 'DAY' : period, direction));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Picker metrics</h1>
          <p className="text-sm text-gray-500">
            Store throughput and per-picker performance — dates use your browser timezone; backend stores UTC.
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <Card className="space-y-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />

        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              className={clsx(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                period === p.id
                  ? 'bg-brand-green text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'CUSTOM' ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block space-y-1">
              <span className="label flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> From</span>
              <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="label">To</span>
              <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost p-2" onClick={() => nudge(-1)} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="block space-y-1">
              <span className="label flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date</span>
              <input type="date" className="input" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            </label>
            <button type="button" className="btn-ghost p-2" onClick={() => nudge(1)} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost text-xs" onClick={() => setAnchorDate(todayIsoLocal())}>
              Today
            </button>
          </div>
        )}
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view metrics.</EmptyState>
      ) : loading && !data ? (
        <Loading label="Loading metrics…" />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-green/20 bg-brand-green/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <BarChart3 className="h-4 w-4 text-brand-green" />
              <span className="font-semibold">{data.periodLabel}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">
                {data.fromDate}
                {data.fromDate !== data.toDate ? ` → ${data.toDate}` : ''}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {data.pickers.length} picker{data.pickers.length === 1 ? '' : 's'} with picks
            </span>
          </div>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pick funnel (SLA)</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Avg assign → start"
                value={fmtMinutes(data.overview.avgAssignToStartMinutes)}
                sub="Time to accept task"
              />
              <Stat
                label="Avg start → complete"
                value={fmtMinutes(data.overview.avgStartToCompleteMinutes)}
                sub="Active pick duration"
              />
              <Stat
                label="Acceptance timeouts"
                value={data.overview.acceptanceTimeoutCount ?? 0}
                sub="Reassignments after timeout"
              />
              <Stat
                label="Orphan orders"
                value={data.overview.orphanOrderCount ?? 0}
                sub="Confirmed, no pick task"
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Store performance</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat label="Tasks completed" value={data.overview.completedTasks} />
              <Stat label="Avg pick time" value={fmtMinutes(data.overview.avgPickMinutes)} />
              <Stat label="Fastest pick" value={fmtMinutes(data.overview.fastestPickMinutes)} sub="Best single task" />
              <Stat label="Slowest pick" value={fmtMinutes(data.overview.slowestPickMinutes)} sub="Longest single task" />
              <Stat label="Active pickers" value={data.overview.activePickers} sub="Completed ≥1 task" />
              <Stat
                label="Queue now"
                value={data.overview.pendingTasks + data.overview.activeTasks}
                sub={`${data.overview.pendingTasks} pending · ${data.overview.activeTasks} active`}
              />
            </div>
          </section>

          {data.dailyTrend.length > 0 && (
            <Card className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Daily trend</h2>
                <p className="text-xs text-gray-500">Completed tasks per local day in this period.</p>
              </div>
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1 pt-2" style={{ minHeight: 140 }}>
                {data.dailyTrend.map((point) => {
                  const height = Math.max(4, Math.round((point.completedTasks / trendMax) * 100));
                  return (
                    <div key={point.date} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-medium text-gray-600">{point.completedTasks}</span>
                      <div
                        className="w-full max-w-[36px] rounded-t-md bg-brand-green/80 transition-all"
                        style={{ height: `${height}px` }}
                        title={`${point.date}: ${point.completedTasks} tasks, avg ${fmtMinutes(point.avgPickMinutes)}`}
                      />
                      <span className="text-[10px] text-gray-400">{fmtDayLabel(point.date)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Users className="h-3.5 w-3.5" /> Roster now
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Available" value={data.roster.available} />
              <Stat label="Picking" value={data.roster.picking} />
              <Stat label="On break" value={data.roster.onBreak} />
              <Stat label="Offline" value={data.roster.offline} />
            </div>
          </section>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Per picker</h2>
              <p className="text-xs text-gray-500">Task counts and pick times for the selected period.</p>
            </div>
            {data.pickers.length === 0 ? (
              <EmptyState>No completed picks in this period.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2.5 font-medium">Picker</th>
                      <th className="px-4 py-2.5 font-medium text-right">Tasks</th>
                      <th className="px-4 py-2.5 font-medium text-right">Avg</th>
                      <th className="px-4 py-2.5 font-medium text-right">Fastest</th>
                      <th className="px-4 py-2.5 font-medium text-right">Slowest</th>
                      <th className="px-4 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.pickers.map((row, idx) => (
                      <tr
                        key={row.pickerId}
                        className={clsx(
                          'border-b border-gray-50 last:border-0',
                          idx === 0 && row.completedTasks > 0 && 'bg-brand-green/[0.03]'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          <div className="font-mono text-xs text-gray-400">#{row.pickerId}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.completedTasks}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmtMinutes(row.avgPickMinutes)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmtMinutes(row.fastestPickMinutes)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtMinutes(row.slowestPickMinutes)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/pickers/${row.pickerId}`} className="text-sm font-medium text-brand-green hover:underline">
                            Profile
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
