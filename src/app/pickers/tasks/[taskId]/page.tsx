'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { TaskDetailResponse } from '@/lib/pickerTypes';
import { formatDurationSeconds, formatPickerStatus, formatTime, taskStatusTone } from '@/lib/pickerUtils';
import { TaskCancelModal } from '@/components/pickers/TaskCancelModal';
import { TaskReassignModal } from '@/components/pickers/TaskReassignModal';
import { Badge, Card, ErrorBox, Loading, SectionTitle } from '@/components/ui';

export default function PickTaskDetailPage() {
  const { taskId: taskIdParam } = useParams<{ taskId: string }>();
  const taskId = parseInt(taskIdParam, 10);
  const router = useRouter();

  const [task, setTask] = useState<TaskDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(taskId)) return;
    setLoading(true);
    setError(null);
    try {
      setTask(await pickerApi.getTaskDetail(taskId));
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load task.');
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!Number.isFinite(taskId)) {
    return <ErrorBox message="Invalid task ID." />;
  }

  const canReassign = task && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status);
  const canCancel = task && !['PICKED', 'CANCELLED'].includes(task.status);

  return (
    <div className="space-y-6">
      <button type="button" className="btn-ghost flex items-center gap-1 text-sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading && <Loading label="Loading task…" />}
      {error && <ErrorBox message={error} />}

      {task && !loading && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pick task #{task.id}</h1>
              <p className="text-sm text-gray-500">
                {task.orderNumber ? (
                  <>
                    Order{' '}
                    <Link href={`/orders/${encodeURIComponent(task.orderNumber)}`} className="font-mono text-blue-600 hover:underline">
                      {task.orderNumber}
                    </Link>
                  </>
                ) : (
                  <span className="font-mono text-xs text-gray-400">{task.orderUuid}</span>
                )}
              </p>
            </div>
            <Badge tone={taskStatusTone(task.status)}>{formatPickerStatus(task.status)}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {canReassign && (
              <button type="button" className="btn-primary text-sm" onClick={() => setReassignOpen(true)}>
                Reassign
              </button>
            )}
            {canCancel && (
              <button type="button" className="btn-danger text-sm" onClick={() => setCancelOpen(true)}>
                Cancel task
              </button>
            )}
          </div>

          <Card>
            <SectionTitle>Task details</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="text-gray-500">Store</dt>
              <dd>{task.storeId}</dd>
              <dt className="text-gray-500">Picker</dt>
              <dd>
                {task.pickerName ? (
                  <>
                    {task.pickerName}
                    {task.pickerId ? ` (#${task.pickerId})` : ''}
                  </>
                ) : (
                  task.pickerId ? `#${task.pickerId}` : '—'
                )}
              </dd>
              <dt className="text-gray-500">Payment</dt>
              <dd>{task.paymentMethod ?? '—'}</dd>
              <dt className="text-gray-500">Delivery zone</dt>
              <dd>{task.deliveryZoneLabel ?? '—'}</dd>
              <dt className="text-gray-500">Created</dt>
              <dd>{formatTime(task.createdAt)}</dd>
              <dt className="text-gray-500">Assigned</dt>
              <dd>{formatTime(task.assignedAt)}</dd>
              <dt className="text-gray-500">Accept by</dt>
              <dd>{formatTime(task.acceptanceDeadline)}</dd>
              <dt className="text-gray-500">Started</dt>
              <dd>{formatTime(task.startedAt)}</dd>
              <dt className="text-gray-500">Completed</dt>
              <dd>{formatTime(task.completedAt)}</dd>
              {task.status === 'IN_PROGRESS' && (
                <>
                  <dt className="text-gray-500">Progress</dt>
                  <dd>
                    {task.processedItemCount != null
                      ? `${task.processedItemCount}/${task.processedItemCount + (task.pendingItemCount ?? 0)} items`
                      : '—'}
                    {task.elapsedSeconds != null ? ` · ${formatDurationSeconds(task.elapsedSeconds)} elapsed` : ''}
                  </dd>
                </>
              )}
              {task.cancelledReason && (
                <>
                  <dt className="text-gray-500">Cancel reason</dt>
                  <dd className="text-red-600">{task.cancelledReason}</dd>
                </>
              )}
            </dl>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Items ({task.items.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">SKU</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Qty</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {task.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className="px-4 py-2.5 text-gray-600">{item.locationCode ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {item.pickedQuantity}/{item.quantity}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={item.status === 'PICKED' ? 'green' : item.status === 'UNAVAILABLE' ? 'red' : 'amber'}>
                          {item.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {task != null && (
        <TaskReassignModal
          open={reassignOpen}
          mode="reassign"
          task={task}
          storeId={task.storeId}
          onClose={() => setReassignOpen(false)}
          onDone={load}
        />
      )}
      <TaskCancelModal open={cancelOpen} task={task} onClose={() => setCancelOpen(false)} onDone={() => router.push('/pickers')} />
    </div>
  );
}
