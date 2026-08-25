'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import type { DriverTripsResponse } from '@/lib/types';
import { Card, EmptyState, ErrorBox, Loading, Stat, formatDate } from '@/components/ui';
import { todayIsoStore } from '@/lib/storeTime';
import { resolveTripRange, tripRangeError, type TripRangePreset } from '@/lib/tripDateRange';

function TripRangeControls({
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo
}: {
  preset: TripRangePreset;
  customFrom: string;
  customTo: string;
  onPreset: (preset: TripRangePreset) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <select className="input w-auto" value={preset} onChange={(e) => onPreset(e.target.value as TripRangePreset)}>
        <option value="today">Today</option>
        <option value="last7">Last 7 days</option>
        <option value="custom">Custom</option>
      </select>
      {preset === 'custom' && (
        <>
          <input
            type="date"
            className="input w-auto"
            value={customFrom}
            max={todayIsoStore()}
            onChange={(e) => onCustomFrom(e.target.value)}
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            className="input w-auto"
            value={customTo}
            max={todayIsoStore()}
            onChange={(e) => onCustomTo(e.target.value)}
          />
        </>
      )}
    </div>
  );
}

export function TripsTab({ phone }: { phone: string }) {
  const [preset, setPreset] = useState<TripRangePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<DriverTripsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => resolveTripRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const rangeError = useMemo(() => tripRangeError(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!range || rangeError) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDriverTrips(phone, { from: range.from, to: range.to }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load trips.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [phone, range, rangeError]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!data?.next_cursor || !range || rangeError) return;
    setLoadingMore(true);
    try {
      const next = await api.getDriverTrips(phone, { from: range.from, to: range.to, cursor: data.next_cursor });
      setData((prev) => (prev ? { ...next, items: [...prev.items, ...next.items] } : next));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          {rangeError ? (
            <ErrorBox message={rangeError} />
          ) : loading ? (
            <Loading label="Loading trips…" />
          ) : error ? (
            <ErrorBox message={error} />
          ) : data ? (
            <>
              <Stat label="Trips" value={data.trip_count} />
              <Stat label="Total distance" value={`${data.total_distance_km.toFixed(2)} km`} />
            </>
          ) : null}
        </div>
        <TripRangeControls
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPreset={setPreset}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Completed trips</h3>
            {!loading && !error && !rangeError && data && (
              <p className="mt-0.5 text-xs text-gray-400">
                {data.trip_count} {data.trip_count === 1 ? 'trip' : 'trips'} · {data.total_distance_km.toFixed(2)} km
              </p>
            )}
          </div>
        </div>

        {rangeError ? (
          <div className="p-5">
            <ErrorBox message={rangeError} />
          </div>
        ) : loading ? (
          <div className="p-5">
            <Loading label="Loading trips…" />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorBox message={error} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-5">
            <EmptyState>No completed trips in this date range.</EmptyState>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Order id</th>
                  <th className="px-5 py-3 text-right font-medium">Distance</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={`${item.order_id}-${i}`} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-700">{formatDate(item.completed_at)}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${encodeURIComponent(item.order_id)}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {item.order_id}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {item.distance_km.toFixed(2)} km
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.next_cursor && (
              <div className="p-5 pt-0">
                <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
