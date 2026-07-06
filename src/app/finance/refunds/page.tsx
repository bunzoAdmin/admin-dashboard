'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { refundAdminApi, RefundAdminApiError, type StuckRefundEntry } from '@/lib/refundAdminApi';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, money, useToast } from '@/components/ui';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function StuckRefundsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<StuckRefundEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await refundAdminApi.listStuck());
    } catch (err) {
      setError(err instanceof RefundAdminApiError ? err.message : 'Failed to load stuck refunds.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRetry(refundId: string) {
    setRetrying(refundId);
    try {
      await refundAdminApi.retry(refundId);
      toast.push('success', 'Refund retry submitted.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof RefundAdminApiError ? err.message : 'Retry failed.');
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stuck Refunds</h1>
        <p className="text-sm text-gray-500">Refunds that exhausted automatic retries and need manual action.</p>
      </div>

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && rows === null ? (
          <div className="p-6"><Loading label="Loading stuck refunds…" /></div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No stuck refunds. All clear.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Order #</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Gateway</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Retries</th>
                  <th className="px-4 py-3 font-medium">Failure reason</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r: StuckRefundEntry) => (
                  <tr key={r.refundId} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {r.orderNumber ? (
                        <Link href={`/orders/${encodeURIComponent(r.orderNumber)}`} className="text-blue-600 hover:underline">
                          {r.orderNumber}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(r.amount)} {r.currency}</td>
                    <td className="px-4 py-3 text-xs uppercase">{r.gateway}</td>
                    <td className="px-4 py-3">
                      <Badge tone="red">{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{r.retryCount}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500" title={r.failureReason ?? undefined}>
                      {r.failureReason ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={retrying === r.refundId}
                        onClick={() => handleRetry(r.refundId)}
                      >
                        {retrying === r.refundId ? <Spinner className="h-3.5 w-3.5" /> : 'Retry'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
