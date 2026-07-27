'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Calendar, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { DeliveredOrderInsight, OrderAnalyticsPeriod, OrderAnalyticsResponse } from '@/lib/orderAnalyticsTypes';
import { nudgeAnchorDate, resolveLocalMetricsRange, todayIsoLocal } from '@/lib/pickerMetricsRange';
import { formatDurationSeconds } from '@/lib/pickerUtils';
import { formatStoreDateTime } from '@/lib/storeTime';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Card, EmptyState, ErrorBox, Loading, Stat, money } from '@/components/ui';

const PERIODS: { id: OrderAnalyticsPeriod; label: string; hint: string }[] = [
  { id: 'DAY', label: 'Day', hint: 'Store calendar day (CAT)' },
  { id: 'WEEK', label: 'Week', hint: 'Mon–Sun in store time (CAT)' },
  { id: 'MONTH', label: 'Month', hint: 'Full store calendar month (CAT)' },
  { id: 'CUSTOM', label: 'Custom', hint: 'Store date range (CAT)' }
];

const SLA_MINUTES = 15;

function fmtDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function pct(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function DeliveryInsightTable({
  title,
  description,
  rows,
  emptyLabel,
  highlightBreaches
}: {
  title: string;
  description: string;
  rows: DeliveredOrderInsight[];
  emptyLabel: string;
  highlightBreaches?: boolean;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>{emptyLabel}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium text-right">E2E</th>
                <th className="px-4 py-2.5 font-medium text-right">GMV</th>
                <th className="px-4 py-2.5 font-medium">Delivered</th>
                <th className="px-4 py-2.5 font-medium text-right">SLA</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const breach = highlightBreaches || !row.withinSla;
                return (
                  <tr
                    key={row.orderNumber}
                    className={clsx(
                      'border-b border-gray-50 last:border-0',
                      breach && 'bg-amber-50/60'
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{row.orderNumber}</td>
                    <td className={clsx(
                      'px-4 py-3 text-right tabular-nums',
                      breach ? 'font-semibold text-amber-800' : 'text-gray-700'
                    )}>
                      {formatDurationSeconds(row.endToEndSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{money(row.gmv)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {row.deliveredAt ? formatStoreDateTime(row.deliveredAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {row.withinSla ? (
                        <span className="text-emerald-700">OK</span>
                      ) : (
                        <span className="font-medium text-amber-800">
                          +{formatDurationSeconds(row.secondsOverSla)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/orders/${encodeURIComponent(row.orderNumber)}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-green hover:underline"
                      >
                        Details
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function OrderMetricsPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [period, setPeriod] = useState<OrderAnalyticsPeriod>('DAY');
  const [anchorDate, setAnchorDate] = useState(todayIsoLocal);
  const [fromDate, setFromDate] = useState(todayIsoLocal);
  const [toDate, setToDate] = useState(todayIsoLocal);
  const [data, setData] = useState<OrderAnalyticsResponse | null>(null);
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
        await orderAdminApi.getAnalytics(storeId, {
          period: range.period,
          from: range.from,
          toExclusive: range.toExclusive,
          label: range.label,
          calendarFrom: range.calendarFrom,
          calendarTo: range.calendarTo,
          utcOffsetMinutes: range.utcOffsetMinutes,
          slaMinutes: SLA_MINUTES
        })
      );
    } catch (err) {
      setError(err instanceof OrderAdminApiError ? err.message : err instanceof Error ? err.message : 'Failed to load metrics.');
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
    return Math.max(1, ...data.dailyTrend.map((d) => Math.max(d.placed, d.delivered, d.cancelled)));
  }, [data]);

  function nudge(direction: -1 | 1) {
    setAnchorDate((d) => nudgeAnchorDate(d, period === 'CUSTOM' ? 'DAY' : period, direction));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order metrics</h1>
          <p className="text-sm text-gray-500">
            Store demand, SLA ({SLA_MINUTES} min), and revenue — dates use store time (CAT).
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
            <span className="text-xs text-gray-500">SLA ≤ {data.slaMinutes} min</span>
          </div>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Volume &amp; outcome</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <Stat label="Placed" value={data.overview.placedOrders} sub="Created in period" />
              <Stat label="Delivered" value={data.overview.deliveredOrders} sub="Delivered in period (may span create days)" />
              <Stat
                label="Cancelled"
                value={data.overview.cancelledOrders}
                sub={`In period · cohort rate ${pct(data.overview.cancelRatePercent)}`}
              />
              <Stat label="GMV" value={money(data.overview.gmv)} sub="Among deliveries in period" />
              <Stat label="AOV" value={data.overview.aov != null ? money(data.overview.aov) : '—'} sub="GMV ÷ delivered" />
              <Stat
                label={`Within ${data.slaMinutes}m SLA`}
                value={pct(data.overview.withinSlaPercent)}
                sub={`${data.overview.withinSlaCount} of ${data.overview.deliveredOrders} deliveries`}
              />
              <Stat
                label="Fastest delivery"
                value={formatDurationSeconds(data.overview.fastestEndToEndSeconds)}
                sub="Best single order"
              />
              <Stat
                label="Slowest delivery"
                value={formatDurationSeconds(data.overview.slowestEndToEndSeconds)}
                sub="Longest single order"
              />
            </div>
          </section>

          {data.overview.deliveredOrders > 0 && (
            <section className="space-y-4">
              <DeliveryInsightTable
                title="Above SLA"
                description={`Deliveries that exceeded ${data.slaMinutes} minutes end-to-end — open details for the full event timeline.`}
                rows={data.slaBreaches ?? []}
                emptyLabel={`All ${data.overview.deliveredOrders} deliveries were within SLA.`}
                highlightBreaches
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <DeliveryInsightTable
                  title="Slowest deliveries"
                  description="Top 5 longest end-to-end times in this period."
                  rows={data.slowestDeliveries ?? []}
                  emptyLabel="No deliveries in this period."
                />
                <DeliveryInsightTable
                  title="Fastest deliveries"
                  description="Top 5 shortest end-to-end times in this period."
                  rows={data.fastestDeliveries ?? []}
                  emptyLabel="No deliveries in this period."
                />
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Speed / SLA (among deliveries in period)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat
                label="Avg end-to-end"
                value={formatDurationSeconds(data.overview.avgEndToEndSeconds)}
                sub="Placed → delivered"
              />
              <Stat
                label="Placed → confirmed"
                value={formatDurationSeconds(data.stageAverages.avgPlacedToConfirmedSeconds)}
                sub="Payment / confirm"
              />
              <Stat
                label="Confirmed → packing"
                value={formatDurationSeconds(data.stageAverages.avgConfirmedToPackingSeconds)}
                sub="Pick queue wait"
              />
              <Stat
                label="Packing → ready"
                value={formatDurationSeconds(data.stageAverages.avgPackingToReadySeconds)}
                sub="Active pick"
              />
              <Stat
                label="Ready → out"
                value={formatDurationSeconds(data.stageAverages.avgReadyToOutSeconds)}
                sub="Rider handoff"
              />
              <Stat
                label="Out → delivered"
                value={formatDurationSeconds(data.stageAverages.avgOutToDeliveredSeconds)}
                sub="Last mile"
              />
            </div>
          </section>

          {data.dailyTrend.length > 0 && (
            <Card className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Daily trend</h2>
                <p className="text-xs text-gray-500">
                  Placed (green) · Delivered (blue) · Cancelled (amber) per local day.
                </p>
              </div>
              <div className="flex items-end gap-2 overflow-x-auto pb-1 pt-2" style={{ minHeight: 160 }}>
                {data.dailyTrend.map((point) => {
                  const hPlaced = Math.max(4, Math.round((point.placed / trendMax) * 110));
                  const hDelivered = Math.max(4, Math.round((point.delivered / trendMax) * 110));
                  const hCancelled = Math.max(4, Math.round((point.cancelled / trendMax) * 110));
                  return (
                    <div key={point.date} className="flex min-w-[56px] flex-1 flex-col items-center gap-1">
                      <div className="flex items-end gap-0.5" style={{ height: 120 }}>
                        <div
                          className="w-3 rounded-t-sm bg-brand-green/80"
                          style={{ height: `${hPlaced}px` }}
                          title={`Placed: ${point.placed}`}
                        />
                        <div
                          className="w-3 rounded-t-sm bg-blue-500/80"
                          style={{ height: `${hDelivered}px` }}
                          title={`Delivered: ${point.delivered}`}
                        />
                        <div
                          className="w-3 rounded-t-sm bg-amber-400/90"
                          style={{ height: `${hCancelled}px` }}
                          title={`Cancelled: ${point.cancelled}`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{fmtDayLabel(point.date)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
