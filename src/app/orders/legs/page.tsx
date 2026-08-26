'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Badge, Card, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { LEG_IDS, formatDurationMmSs, type OrderLegRow, type Tone } from '@/lib/orderLegs';
import { loadDayLegRows } from '@/lib/orderLegsLoad';
import { filterLegRows, pageLegRows, type LegChip } from '@/lib/orderLegsView';
import { nudgeAnchorDate, resolveLocalMetricsRange } from '@/lib/pickerMetricsRange';
import { formatStoreDateTime, todayIsoStore } from '@/lib/storeTime';

const LEG_HEADERS: Record<(typeof LEG_IDS)[number], string> = {
  created_to_confirmed: 'Created→Conf',
  confirmed_to_pick_start: 'Conf→Pick',
  pick_start_to_pick_end: 'Pick',
  pick_end_to_ofd: 'Pick→OFD',
  ofd_to_reached: 'OFD→Rch',
  reached_to_delivered: 'Rch→Dlv'
};

const CHIPS: { id: LegChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'in_flight', label: 'In flight' },
  { id: 'has_red', label: 'Has red' }
];

function orderStatusTone(status: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'DELIVERED':
      return 'green';
    case 'CONFIRMED':
    case 'PACKING':
    case 'READY_FOR_DELIVERY':
    case 'OUT_FOR_DELIVERY':
      return 'blue';
    case 'PENDING_PAYMENT':
      return 'amber';
    case 'CANCELLED':
      return 'red';
    default:
      return 'gray';
  }
}

function toneClass(tone: Tone | null): string {
  if (tone === 'ok') return 'text-gray-900';
  if (tone === 'absurd') return 'text-amber-500';
  if (tone === 'preposterous') return 'text-red-600';
  return 'text-gray-400';
}

function predLabel(minutes: number | null | undefined): string {
  return minutes == null ? '—' : `${minutes}m`;
}

function kmLabel(km: number | null): string {
  return km == null ? '—' : km.toFixed(2);
}

export default function DayLegsPage() {
  const router = useRouter();
  const { storeId, setStoreId } = useStoreContext();
  const [anchorDate, setAnchorDate] = useState(todayIsoStore);
  const [chip, setChip] = useState<LegChip>('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<OrderLegRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const range = resolveLocalMetricsRange({
        period: 'DAY',
        anchorDate,
        customFrom: '',
        customTo: ''
      });
      const result = await loadDayLegRows(storeId, range.from, range.toExclusive, Date.now());
      setRows(result.rows);
      setTruncated(result.truncated);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load day legs.');
      setRows([]);
      setTruncated(false);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [storeId, anchorDate]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => filterLegRows(rows, chip), [rows, chip]);
  const paged = useMemo(() => pageLegRows(filtered, page), [filtered, page]);

  function changeDate(next: string) {
    setAnchorDate(next);
    setPage(0);
  }

  function changeChip(next: LegChip) {
    setChip(next);
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Day legs</h1>
          <p className="text-sm text-gray-500">
            Per-order stage durations for a store calendar day (CAT).
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <Card className="space-y-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => changeDate(nudgeAnchorDate(anchorDate, 'DAY', -1))}
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="block space-y-1">
            <span className="label flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Date
            </span>
            <input
              type="date"
              className="input"
              value={anchorDate}
              onChange={(e) => changeDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => changeDate(nudgeAnchorDate(anchorDate, 'DAY', 1))}
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={() => changeDate(todayIsoStore())}>
            Today
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={clsx(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                chip === c.id
                  ? 'bg-brand-green text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              onClick={() => changeChip(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      {error && <ErrorBox message={error} />}

      {truncated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing the first {rows.length} of {total} orders for this day.
        </div>
      )}

      {storeId == null ? (
        <EmptyState>Select a store to view day legs.</EmptyState>
      ) : loading && rows.length === 0 && !error ? (
        <Loading label="Loading day legs…" />
      ) : filtered.length === 0 ? (
        <EmptyState>No orders for this day and filter.</EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium text-right">Units</th>
                  <th className="px-4 py-2.5 font-medium text-right">km</th>
                  {LEG_IDS.map((id) => (
                    <th key={id} className="px-4 py-2.5 font-medium text-right">
                      {LEG_HEADERS[id]}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-medium text-right">Item pred</th>
                  <th className="px-4 py-2.5 font-medium text-right">LM pred</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pred e2e</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actual e2e</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => {
                  const href = `/orders/${encodeURIComponent(row.orderNumber)}`;
                  return (
                    <tr
                      key={row.orderNumber}
                      className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                      onClick={() => router.push(href)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        <Link
                          href={href}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={orderStatusTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatStoreDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.units}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{kmLabel(row.distanceKm)}</td>
                      {LEG_IDS.map((id) => {
                        const leg = row.legs.find((l) => l.id === id);
                        return (
                          <td
                            key={id}
                            className={clsx('px-4 py-3 text-right tabular-nums', toneClass(leg?.tone ?? null))}
                          >
                            {formatDurationMmSs(leg?.actualSeconds)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {predLabel(row.itemPredictedMinutes)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {predLabel(row.lastMilePredictedMinutes)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {predLabel(row.predictedE2eMinutes)}
                      </td>
                      <td className={clsx('px-4 py-3 text-right tabular-nums', toneClass(row.e2eTone))}>
                        {formatDurationMmSs(row.actualE2eSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 50 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <span className="text-xs text-gray-500">
                {page * 50 + 1}–{Math.min((page + 1) * 50, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost px-3 py-1 text-xs"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1 text-xs"
                  disabled={(page + 1) * 50 >= filtered.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
