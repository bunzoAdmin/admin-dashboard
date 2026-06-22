'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { CashLedger } from '@/lib/types';
import { Card, EmptyState, ErrorBox, Loading, Stat, formatDate, money } from '@/components/ui';

export function CashTab({ phone, refreshKey }: { phone: string; refreshKey: number }) {
  const [data, setData] = useState<CashLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <Loading label="Loading cash ledger…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Stat label="Cash in hand" value={money(data.in_hand_cash_zmw)} sub="Uncollected COD" />
      </div>

      <Card className="p-0">
        {data.deposits.length === 0 ? (
          <div className="p-5">
            <EmptyState>No cash deposits recorded yet.</EmptyState>
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
              {data.deposits.map((d) => (
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
    </div>
  );
}
