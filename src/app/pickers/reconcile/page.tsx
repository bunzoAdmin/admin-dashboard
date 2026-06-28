'use client';

import { useCallback, useEffect, useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { ReconciliationOutboxResponse } from '@/lib/pickerTypes';
import { formatTime } from '@/lib/pickerUtils';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';

export default function ReconcilePage() {
  const toast = useToast();
  const [rows, setRows] = useState<ReconciliationOutboxResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await pickerApi.listReconcileFailures(0, 100));
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load failures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function replay(id: number) {
    setReplaying(id);
    try {
      await pickerApi.replayReconcile(id);
      toast.push('success', 'Replay submitted.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Replay failed.');
    } finally {
      setReplaying(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reconciliation</h1>
        <p className="text-sm text-gray-500">Failed inventory/order sync jobs from picker operations — replay to retry.</p>
      </div>

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && rows === null ? (
          <div className="p-6">
            <Loading label="Loading failures…" />
          </div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No reconciliation failures. All clear.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Last error</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3">
                      <Badge tone="red">{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{r.attemptCount}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500" title={r.lastError ?? undefined}>
                      {r.lastError ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatTime(r.createdAt ?? undefined)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={replaying === r.id} onClick={() => replay(r.id)}>
                        {replaying === r.id ? <Spinner className="h-3.5 w-3.5" /> : 'Replay'}
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
