'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type {
  PickerResponse,
  PickerStoreMetricsResponse,
  PickTaskStatus,
  PickerStatus,
  ShiftResponse,
  TaskListResponse
} from '@/lib/pickerTypes';
import { PICKER_STATUS_OPTIONS, TASK_STATUS_OPTIONS } from '@/lib/pickerTypes';
import { formatDurationSeconds, formatPickerStatus, formatTime, pickerStatusTone, taskStatusTone } from '@/lib/pickerUtils';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { TaskCancelModal } from '@/components/pickers/TaskCancelModal';
import { TaskReassignModal } from '@/components/pickers/TaskReassignModal';
import { Badge, Card, EmptyState, ErrorBox, Loading, Stat } from '@/components/ui';


export default function PickersLiveOpsPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [pickers, setPickers] = useState<PickerResponse[] | null>(null);
  const [tasks, setTasks] = useState<TaskListResponse[] | null>(null);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [metrics, setMetrics] = useState<PickerStoreMetricsResponse | null>(null);
  const [pickerFilter, setPickerFilter] = useState<PickerStatus | ''>('');
  const [pickerSearchInput, setPickerSearchInput] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<PickTaskStatus | ''>('');
  const [includeOffboarded, setIncludeOffboarded] = useState(false);
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
      const [p, t, s, m] = await Promise.all([
        pickerApi.listPickers(storeId, {
          status: pickerFilter || undefined,
          q: pickerSearch || undefined,
          size: 100,
          includeOffboarded
        }),
        pickerApi.listTasks(storeId, { status: taskFilter || undefined, size: 100 }),
        pickerApi.listShifts(storeId).catch(() => [] as ShiftResponse[]),
        pickerApi.getMetrics(storeId).catch(() => null)
      ]);
      setPickers(p);
      setTasks(t);
      setShifts(s);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load live ops.');
    } finally {
      setLoading(false);
    }
  }, [storeId, pickerFilter, pickerSearch, taskFilter, includeOffboarded]);

  useEffect(() => {
    const id = setTimeout(() => setPickerSearch(pickerSearchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [pickerSearchInput]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Picker live ops</h1>
          <p className="text-sm text-gray-500">Store roster and pick task queue — refreshes every 30s.</p>
          <Link href="/pickers/attention" className="text-sm font-medium text-brand-green hover:underline">
            View needs attention →
          </Link>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Stat label="Available" value={metrics?.availablePickers ?? '—'} />
            <Stat label="Picking" value={metrics?.pickingPickers ?? '—'} />
            <Stat label="On break" value={metrics?.onBreakPickers ?? '—'} />
            <Stat label="Offline" value={metrics?.offlinePickers ?? '—'} />
            <Stat label="Pending" value={metrics?.pendingTasks ?? '—'} />
            <Stat label="Active tasks" value={metrics?.activeTasks ?? '—'} sub="Assigned + in progress" />
            <Stat
              label="Completed today"
              value={metrics?.completedToday ?? '—'}
              sub={metrics ? `Avg ${formatDurationSeconds(metrics.avgPickSecondsToday)}` : undefined}
            />
            <Stat
              label="Needs attention"
              value={metrics?.attentionCount ?? '—'}
              sub={
                metrics && metrics.attentionCount > 0 ? (
                  <Link href="/pickers/attention" className="text-brand-green hover:underline">
                    Open queue
                  </Link>
                ) : (
                  'All clear'
                )
              }
            />
          </div>

          {metrics && metrics.topPickers.length > 0 && (
            <Card className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Top pickers today</h2>
              <div className="flex flex-wrap gap-3">
                {metrics.topPickers.slice(0, 5).map((row) => (
                  <Link
                    key={row.pickerId}
                    href={`/pickers/${row.pickerId}`}
                    className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm hover:border-brand-green/30"
                  >
                    <span className="font-medium text-gray-900">{row.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {row.completedToday} · {formatDurationSeconds(row.avgPickSeconds)}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {loading && pickers === null ? (
            <Loading label="Loading…" />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Pickers</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={includeOffboarded}
                    onChange={(e) => setIncludeOffboarded(e.target.checked)}
                  />
                  Show offboarded
                </label>
                <label className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    className="input w-44 py-1 pl-8 text-xs sm:w-52"
                    placeholder="Name or phone…"
                    value={pickerSearchInput}
                    onChange={(e) => setPickerSearchInput(e.target.value)}
                    aria-label="Search pickers by name or phone"
                  />
                </label>
                <select className="input w-auto py-1 text-xs" value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value as PickerStatus | '')}>
                  {PICKER_STATUS_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!pickers || pickers.length === 0 ? (
              <EmptyState>
                {pickerSearch ? `No pickers match “${pickerSearch}”.` : 'No pickers at this store.'}
              </EmptyState>
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
                      const offboarded = !!p.offboardedAt;
                      return (
                        <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">{p.name}</span>
                              {offboarded && <Badge tone="red">Offboarded</Badge>}
                            </div>
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
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {t.pickerName ?? (t.pickerId ? `#${t.pickerId}` : '—')}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {t.status === 'IN_PROGRESS' && t.processedItemCount != null ? (
                            <>
                              {t.processedItemCount}/{t.processedItemCount + (t.pendingItemCount ?? 0)} items
                              {t.elapsedSeconds != null ? ` · ${formatDurationSeconds(t.elapsedSeconds)}` : ''}
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
                            {['ASSIGNED', 'IN_PROGRESS'].includes(t.status) && (
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
