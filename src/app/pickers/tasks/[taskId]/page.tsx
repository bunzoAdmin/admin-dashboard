'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { TaskListResponse } from '@/lib/pickerTypes';
import { formatPickerStatus, formatTime, taskStatusTone } from '@/lib/pickerUtils';
import { Badge, Card, ErrorBox, Loading, SectionTitle } from '@/components/ui';

export default function PickTaskDetailPage() {
  const { taskId: taskIdParam } = useParams<{ taskId: string }>();
  const taskId = parseInt(taskIdParam, 10);
  const router = useRouter();

  const [task, setTask] = useState<TaskListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(taskId)) return;
    setLoading(true);
    setError(null);
    try {
      setTask(await pickerApi.getTask(taskId));
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
                  <>Order{' '}
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

          <Card>
            <SectionTitle>Task details</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="text-gray-500">Store</dt>
              <dd>{task.storeId}</dd>
              <dt className="text-gray-500">Picker</dt>
              <dd>{task.pickerId ? `#${task.pickerId}` : '—'}</dd>
              <dt className="text-gray-500">Created</dt>
              <dd>{formatTime(task.createdAt)}</dd>
              <dt className="text-gray-500">Assigned</dt>
              <dd>{formatTime(task.assignedAt)}</dd>
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
                    {task.elapsedMinutes != null ? ` · ${task.elapsedMinutes}m elapsed` : ''}
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
        </>
      )}
    </div>
  );
}
