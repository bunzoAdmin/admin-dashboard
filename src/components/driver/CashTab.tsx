'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import type { CashCollectionsResponse, CashDeposit, CashLedger } from '@/lib/types';
import { Card, EmptyState, ErrorBox, Loading, Stat, formatDate, money } from '@/components/ui';
import { addStoreCalendarDays, todayIsoStore } from '@/lib/storeTime';

const MAX_CUSTOM_RANGE_DAYS = 31;

type CashRangePreset = 'today' | 'last7' | 'custom';

function resolveCashRange(
  preset: CashRangePreset,
  customFrom: string,
  customTo: string
): { from: string; to: string } | null {
  const today = todayIsoStore();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'last7') return { from: addStoreCalendarDays(today, -6), to: today };
  if (!customFrom || !customTo) return null;
  return { from: customFrom, to: customTo };
}

function depositsInStoreRange(deposits: CashDeposit[], from: string, to: string): CashDeposit[] {
  const start = new Date(`${from}T00:00:00+02:00`).getTime();
  const end = new Date(`${addStoreCalendarDays(to, 1)}T00:00:00+02:00`).getTime();
  return deposits
    .filter((d) => {
      const t = new Date(d.created_at).getTime();
      return Number.isFinite(t) && t >= start && t < end;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function CashRangeControls({
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo
}: {
  preset: CashRangePreset;
  customFrom: string;
  customTo: string;
  onPreset: (preset: CashRangePreset) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <select className="input w-auto" value={preset} onChange={(e) => onPreset(e.target.value as CashRangePreset)}>
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

function CashCollectedSection({
  phone,
  range,
  rangeError
}: {
  phone: string;
  range: { from: string; to: string } | null;
  rangeError: string | null;
}) {
  const [data, setData] = useState<CashCollectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!range || rangeError) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDriverCashCollections(phone, { from: range.from, to: range.to }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load cash collections.');
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
      const next = await api.getDriverCashCollections(phone, { from: range.from, to: range.to, cursor: data.next_cursor });
      setData((prev) => (prev ? { ...next, items: [...prev.items, ...next.items] } : next));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">COD collected</h3>
          {!loading && !error && data && (
            <p className="mt-0.5 text-xs text-gray-400">
              {data.order_count} {data.order_count === 1 ? 'order' : 'orders'} · {money(data.total_zmw)}
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
          <Loading label="Loading cash collections…" />
        </div>
      ) : error ? (
        <div className="p-5">
          <ErrorBox message={error} />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="p-5">
          <EmptyState>No COD collected in this date range.</EmptyState>
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Order id</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={`${item.order_id}-${i}`} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-700">{formatDate(item.delivered_at)}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/orders/${encodeURIComponent(item.order_number)}`}
                      className="font-mono text-xs text-blue-600 hover:underline"
                    >
                      {item.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{money(item.amount_zmw)}</td>
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
  );
}

export function CashTab({ phone, refreshKey }: { phone: string; refreshKey: number }) {
  const [data, setData] = useState<CashLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<CashRangePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(() => resolveCashRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const rangeError = useMemo(() => {
    if (preset !== 'custom') return null;
    if (!customFrom || !customTo) return 'Pick a from and to date.';
    if (customTo < customFrom) return '"To" date must be on or after "from" date.';
    const spanDays =
      Math.round((new Date(`${customTo}T00:00:00Z`).getTime() - new Date(`${customFrom}T00:00:00Z`).getTime()) /
        86_400_000) + 1;
    if (spanDays > MAX_CUSTOM_RANGE_DAYS) return `Custom range can span at most ${MAX_CUSTOM_RANGE_DAYS} days.`;
    return null;
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDriverCashLedger(phone));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load cash ledger.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const rangedDeposits = useMemo(() => {
    if (!data || !range || rangeError) return [];
    return depositsInStoreRange(data.deposits, range.from, range.to);
  }, [data, range, rangeError]);

  const depositedTotal = rangedDeposits.reduce((sum, d) => sum + d.applied_amount_zmw, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          {loading ? (
            <Loading label="Loading cash ledger…" />
          ) : error ? (
            <ErrorBox message={error} />
          ) : data ? (
            <>
              <Stat label="Cash in hand" value={money(data.in_hand_cash_zmw)} sub="Uncollected COD" />
              <Stat
                label="Cash deposited"
                value={money(depositedTotal)}
                sub={
                  range && !rangeError
                    ? `${rangedDeposits.length} ${rangedDeposits.length === 1 ? 'deposit' : 'deposits'} in range`
                    : 'Pick a date range'
                }
              />
            </>
          ) : null}
        </div>
        <CashRangeControls
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPreset={setPreset}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />
      </div>

      <CashCollectedSection phone={phone} range={range} rangeError={rangeError} />

      {!loading && !error && data && (
        <Card className="p-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Cash deposited</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {rangedDeposits.length} {rangedDeposits.length === 1 ? 'deposit' : 'deposits'} · {money(depositedTotal)}
              </p>
            </div>
          </div>
          {rangeError ? (
            <div className="p-5">
              <ErrorBox message={rangeError} />
            </div>
          ) : rangedDeposits.length === 0 ? (
            <div className="p-5">
              <EmptyState>No cash deposits recorded in this date range.</EmptyState>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Deposit ID</th>
                  <th className="px-5 py-3 text-right font-medium">Requested</th>
                  <th className="px-5 py-3 text-right font-medium">Applied</th>
                </tr>
              </thead>
              <tbody>
                {rangedDeposits.map((d) => (
                  <tr key={d.deposit_id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-700">{formatDate(d.created_at)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{d.deposit_id}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{money(d.requested_amount_zmw)}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{money(d.applied_amount_zmw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
