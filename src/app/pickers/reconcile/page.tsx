'use client';

import { useCallback, useEffect, useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { ReconciliationOutboxResponse } from '@/lib/pickerTypes';
import { formatTime } from '@/lib/pickerUtils';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';

function statusTone(status: string): 'red' | 'amber' | 'green' | 'gray' {
  switch (status) {
    case 'ABANDONED': return 'red';      // permanent failure — needs human action
    case 'PENDING':   return 'amber';    // will retry automatically
    case 'SUCCEEDED': return 'green';
    default:          return 'gray';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ABANDONED': return 'Abandoned — action required';
    case 'PENDING':   return 'Pending retry';
    case 'SUCCEEDED': return 'Succeeded';
    default:          return status;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'STOCK_RETURN':       return 'Stock return';
    case 'DISCREPANCY_REPORT': return 'Discrepancy report';
    case 'INVENTORY_CONFIRM':  return 'Inventory confirm';
    case 'INVENTORY_CANCEL':   return 'Inventory cancel';
    default:                   return type;
  }
}

export default function SyncFailuresPage() {
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
      setError(err instanceof PickerApiError ? err.message : 'Failed to load sync failures.');
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
      const result = await pickerApi.replayReconcile(id);
      if (result.status === 'SUCCEEDED') {
        toast.push('success', 'Replay succeeded — job cleared.');
      } else {
        toast.push('error', result.lastError ?? `Replay did not succeed (status: ${result.status}).`);
      }
      await load();
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Replay failed.');
      await load();
    } finally {
      setReplaying(null);
    }
  }

  const abandonedCount = rows?.filter((r) => r.status === 'ABANDONED').length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inventory Sync Failures</h1>
        <p className="text-sm text-gray-500">
          Failed inventory sync jobs from picker and order events — retried automatically every 15 min.
          Replay now to force an immediate retry.
        </p>
      </div>

      {abandonedCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>{abandonedCount} job{abandonedCount > 1 ? 's' : ''} permanently failed</strong> (max retries
          reached). These will not be retried automatically — replay each one manually to recover, or
          investigate the underlying error first.
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && rows === null ? (
          <div className="p-6">
            <Loading label="Loading sync failures…" />
          </div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No sync failures. All clear.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Next retry</th>
                  <th className="px-4 py-3 font-medium">Last error</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-3 text-xs font-medium">{typeLabel(r.type)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">{r.attemptCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.status === 'ABANDONED' ? '—' : r.nextRetryAt ? formatTime(r.nextRetryAt) : 'soon'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500" title={r.lastError ?? undefined}>
                      {r.lastError ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatTime(r.createdAt ?? undefined)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={replaying === r.id}
                        onClick={() => replay(r.id)}
                      >
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
