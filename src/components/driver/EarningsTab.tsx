'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { EarningsSummary } from '@/lib/types';
import { Card, EmptyState, ErrorBox, Loading, Stat, formatDate, money } from '@/components/ui';

export function EarningsTab({ phone }: { phone: string }) {
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDriverEarnings(phone));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load earnings.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!data?.next_cursor) return;
    setLoadingMore(true);
    try {
      const next = await api.getDriverEarnings(phone, data.next_cursor);
      setData((prev) =>
        prev
          ? { ...next, line_items: [...prev.line_items, ...next.line_items] }
          : next
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <Loading label="Loading earnings…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Outstanding balance" value={money(data.outstanding_balance_zmw)} sub="Since last payout" />
        <Stat label="Live order earnings" value={money(data.live_order_total_zmw)} />
        <Stat label="Bonuses" value={money(data.bonus_total_zmw)} />
      </div>

      <Card className="p-0">
        {data.line_items.length === 0 ? (
          <div className="p-5">
            <EmptyState>No earnings recorded since the last payout.</EmptyState>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Label</th>
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.line_items.map((item) => (
                <tr key={item.earning_id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 capitalize text-gray-700">{item.type}</td>
                  <td className="px-5 py-3 text-gray-500">{item.label || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(item.created_at)}</td>
                  <td className={`px-5 py-3 text-right font-medium ${item.amount_zmw < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {money(item.amount_zmw)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data.next_cursor && (
        <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
