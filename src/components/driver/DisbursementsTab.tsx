'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { Disbursement } from '@/lib/types';
import { Card, EmptyState, ErrorBox, Loading, formatDate, money } from '@/components/ui';

export function DisbursementsTab({ phone }: { phone: string }) {
  const [items, setItems] = useState<Disbursement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDriverDisbursements(phone);
      setItems(res.disbursements);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load disbursements.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading disbursements…" />;
  if (error) return <ErrorBox message={error} />;
  if (!items) return null;

  if (items.length === 0) return <EmptyState>No payouts recorded yet.</EmptyState>;

  return (
    <Card className="p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-5 py-3 font-medium">Disbursed</th>
            <th className="px-5 py-3 font-medium">Period</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.disbursement_id} className="border-b border-gray-50 last:border-0">
              <td className="px-5 py-3 text-gray-700">{formatDate(d.disbursed_at)}</td>
              <td className="px-5 py-3 text-gray-500">
                {d.period_from} → {d.period_to}
              </td>
              <td className="px-5 py-3 text-right font-medium text-gray-900">{money(d.amount_zmw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
