'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { PickerResponse, PickTaskStatus, PickerStatus, ShiftResponse, TaskListResponse } from '@/lib/pickerTypes';
import { ACTIVE_TASK_STATUSES, PICKER_STATUS_OPTIONS, TASK_STATUS_OPTIONS } from '@/lib/pickerTypes';
import { formatPickerStatus, formatTime, pickerStatusTone, taskStatusTone } from '@/lib/pickerUtils';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { TaskCancelModal } from '@/components/pickers/TaskCancelModal';
import { TaskReassignModal } from '@/components/pickers/TaskReassignModal';
import { Badge, Card, EmptyState, ErrorBox, Loading, Stat } from '@/components/ui';

export default function PickersLiveOpsPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [pickers, setPickers] = useState<PickerResponse[] | null>(null);
  const [tasks, setTasks] = useState<TaskListResponse[] | null>(null);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [pickerFilter, setPickerFilter] = useState<PickerStatus | ''>('');
  const [taskFilter, setTaskFilter] = useState<PickTaskStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reassignTask, setReassignTask] = useState<TaskListResponse | null>(null);
  const [cancelTask, setCancelTask] = useState<TaskListResponse | null>(null);

  const shiftMap = useMemo(() => {
    const m = new Map<number, ShiftResponse>();
    for (const s of shifts) m.set(s.id, s);
    return m;
  }, [shifts]);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [p, t, s] = await Promise.all([
        pickerApi.listPickers(storeId, { status: pickerFilter || undefined, size: 100 }),
        pickerApi.listTasks(storeId, { status: taskFilter || undefined, size: 100 }),
        pickerApi.listShifts(storeId).catch(() => [] as ShiftResponse[])
      ]);
      setPickers(p);
      setTasks(t);
      setShifts(s);
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load live ops.');
    } finally {
      setLoading(false);
    }
  }, [storeId, pickerFilter, taskFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    const all = pickers ?? [];
    const count = (s: PickerStatus) => all.filter((p) => p.status === s).length;
    const activeTasks = (tasks ?? []).filter((t) => ACTIVE_TASK_STATUSES.includes(t.status)).length;
    return {
      available: count('AVAILABLE'),
      picking: count('PICKING'),
      onBreak: count('ON_BREAK'),
      offline: count('OFFLINE'),
      activeTasks
    };
  }, [pickers, tasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Picker live ops</h1>
          <p className="text-sm text-gray-500">Store roster and pick task queue — refreshes every 30s.</p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store above to view live ops.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Available" value={stats.available} />
            <Stat label="Picking" value={stats.picking} />
            <Stat label="On break" value={stats.onBreak} />
            <Stat label="Offline" value={stats.offline} />
            <Stat label="Active tasks" value={stats.activeTasks} sub="Assigned + in progress" />
          </div>

          {loading && pickers === null ? (
            <Loading label="Loading…" />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Pickers</h2>
              <select className="input w-auto py-1 text-xs" value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value as PickerStatus | '')}>
                {PICKER_STATUS_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {!pickers || pickers.length === 0 ? (
              <EmptyState>No pickers at this store.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Shift</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {pickers.map((p) => {
                      const shift = p.shiftId ? shiftMap.get(p.shiftId) : undefined;
                      return (
                        <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900">{p.name}</div>
                            <div className="font-mono text-xs text-gray-400">{p.phone}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone={pickerStatusTone(p.status)}>{formatPickerStatus(p.status)}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{shift?.displayName ?? (p.shiftId ? `#${p.shiftId}` : '—')}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Link href={`/pickers/${p.id}`} className="text-sm font-medium text-brand-green hover:underline">
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Pick tasks</h2>
              <select className="input w-auto py-1 text-xs" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as PickTaskStatus | '')}>
                {TASK_STATUS_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {!tasks || tasks.length === 0 ? (
              <EmptyState>No tasks for this filter.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2 font-medium">Order</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Picker</th>
                      <th className="px-4 py-2 font-medium">Progress</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{t.orderNumber ?? '—'}</div>
                          <div className="text-xs text-gray-400">{formatTime(t.assignedAt ?? t.createdAt)}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={taskStatusTone(t.status)}>{formatPickerStatus(t.status)}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{t.pickerId ? `#${t.pickerId}` : '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {t.status === 'IN_PROGRESS' && t.processedItemCount != null ? (
                            <>
                              {t.processedItemCount}/{t.processedItemCount + (t.pendingItemCount ?? 0)} items
                              {t.elapsedMinutes != null ? ` · ${t.elapsedMinutes}m` : ''}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/pickers/tasks/${t.id}`} className="text-xs font-medium text-gray-600 hover:underline">
                              View
                            </Link>
                            {t.status === 'ASSIGNED' && (
                              <button type="button" className="text-xs font-medium text-brand-green hover:underline" onClick={() => setReassignTask(t)}>
                                Reassign
                              </button>
                            )}
                            {!['PICKED', 'CANCELLED'].includes(t.status) && (
                              <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setCancelTask(t)}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </Card>
            </div>
          )}
        </>
      )}

      {storeId != null && <TaskReassignModal open={!!reassignTask} task={reassignTask} storeId={storeId} onClose={() => setReassignTask(null)} onDone={load} />}
      <TaskCancelModal open={!!cancelTask} task={cancelTask} onClose={() => setCancelTask(null)} onDone={load} />
    </div>
  );
}
