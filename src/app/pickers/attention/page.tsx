'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { AttentionItemResponse, TaskListResponse } from '@/lib/pickerTypes';
import { formatTime } from '@/lib/pickerUtils';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { TaskCancelModal } from '@/components/pickers/TaskCancelModal';
import { TaskReassignModal } from '@/components/pickers/TaskReassignModal';
import { Badge, Card, EmptyState, ErrorBox, Loading } from '@/components/ui';

const KIND_TONE: Record<string, 'gray' | 'green' | 'amber' | 'red' | 'blue'> = {
  PENDING_TASK: 'amber',
  ORPHAN_ORDER: 'red',
  ACCEPTANCE_TIMEOUT: 'amber',
  IN_PROGRESS_STALE: 'blue'
};

const KIND_LABEL: Record<string, string> = {
  PENDING_TASK: 'Pending task',
  ORPHAN_ORDER: 'Orphan order',
  ACCEPTANCE_TIMEOUT: 'Acceptance timeout',
  IN_PROGRESS_STALE: 'Slow pick'
};

function toTaskStub(item: AttentionItemResponse): TaskListResponse | null {
  if (item.taskId == null) return null;
  return {
    id: item.taskId,
    orderUuid: item.orderUuid ?? '',
    orderNumber: item.orderNumber,
    storeId: item.storeId ?? 0,
    pickerId: item.pickerId,
    pickerName: item.pickerName,
    status: (item.taskStatus as TaskListResponse['status']) ?? 'PENDING'
  };
}

export default function PickerAttentionPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [items, setItems] = useState<AttentionItemResponse[] | null>(null);
  const [staleMinutes, setStaleMinutes] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reassignItem, setReassignItem] = useState<AttentionItemResponse | null>(null);
  const [assignItem, setAssignItem] = useState<AttentionItemResponse | null>(null);
  const [cancelItem, setCancelItem] = useState<AttentionItemResponse | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await pickerApi.listAttention(storeId, staleMinutes);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load attention queue.');
    } finally {
      setLoading(false);
    }
  }, [storeId, staleMinutes]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const reassignTask = reassignItem ? toTaskStub(reassignItem) : null;
  const cancelTask = cancelItem ? toTaskStub(cancelItem) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Needs attention</h1>
          <p className="text-sm text-gray-500">
            Stuck picks, orphan orders, and acceptance timeouts — refreshes every 30s.
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
        <label className="block space-y-1.5">
          <span className="label">Slow pick threshold (minutes)</span>
          <input
            type="number"
            min={1}
            max={120}
            className="input w-28"
            value={staleMinutes}
            onChange={(e) => setStaleMinutes(Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 5)))}
          />
        </label>
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view items needing attention.</EmptyState>
      ) : loading && items === null ? (
        <Loading label="Loading…" />
      ) : items && items.length === 0 ? (
        <EmptyState>All clear — nothing needs attention at this store.</EmptyState>
      ) : items ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Issue</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Picker</th>
                  <th className="px-4 py-3 font-medium">Since</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const canAssign =
                    item.kind === 'ORPHAN_ORDER' ||
                    item.kind === 'PENDING_TASK' ||
                    (item.kind === 'ACCEPTANCE_TIMEOUT' && !item.pickerId);
                  const canReassign =
                    item.taskId != null &&
                    (item.kind === 'ACCEPTANCE_TIMEOUT' || item.kind === 'IN_PROGRESS_STALE') &&
                    !!item.pickerId;
                  const canCancel =
                    item.taskId != null &&
                    item.taskStatus != null &&
                    !['PICKED', 'CANCELLED'].includes(item.taskStatus);

                  return (
                    <tr key={`${item.kind}-${item.taskId ?? item.orderUuid ?? idx}`} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3">
                        <Badge tone={KIND_TONE[item.kind] ?? 'gray'}>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.orderNumber ? (
                          <Link href={`/orders/${encodeURIComponent(item.orderNumber)}`} className="font-mono text-blue-600 hover:underline">
                            {item.orderNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-gray-400">{item.orderUuid ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.pickerName || (item.pickerId ? `#${item.pickerId}` : '—')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatTime(item.since ?? undefined)}
                        {item.elapsedMinutes != null ? ` · ${item.elapsedMinutes}m` : ''}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-gray-500">{item.detail ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {item.taskId ? (
                            <Link href={`/pickers/tasks/${item.taskId}`} className="text-xs font-medium text-gray-600 hover:underline">
                              Open task
                            </Link>
                          ) : item.orderNumber ? (
                            <Link href={`/orders/${encodeURIComponent(item.orderNumber)}`} className="text-xs font-medium text-gray-600 hover:underline">
                              Open order
                            </Link>
                          ) : null}
                          {canAssign && item.orderNumber && storeId != null && (
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-green hover:underline"
                              onClick={() => setAssignItem(item)}
                            >
                              Assign
                            </button>
                          )}
                          {canReassign && (
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-green hover:underline"
                              onClick={() => setReassignItem(item)}
                            >
                              Reassign
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 hover:underline"
                              onClick={() => setCancelItem(item)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {storeId != null && (
        <>
          <TaskReassignModal
            open={!!assignItem}
            mode="assign"
            task={null}
            orderNumber={assignItem?.orderNumber ?? undefined}
            storeId={storeId}
            onClose={() => setAssignItem(null)}
            onDone={load}
          />
          <TaskReassignModal
            open={!!reassignTask}
            mode="reassign"
            task={reassignTask}
            storeId={storeId}
            onClose={() => setReassignItem(null)}
            onDone={load}
          />
        </>
      )}
      <TaskCancelModal
        open={!!cancelTask}
        task={cancelTask}
        onClose={() => setCancelItem(null)}
        onDone={load}
      />
    </div>
  );
}
