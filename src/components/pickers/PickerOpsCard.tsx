'use client';

import { useCallback, useEffect, useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { TaskListResponse } from '@/lib/pickerTypes';
import { Badge, Card, ErrorBox, Loading, SectionTitle, formatDate } from '@/components/ui';
import { TaskReassignModal } from '@/components/pickers/TaskReassignModal';

/** UI-only threshold for flagging a stuck pick on the order detail page — not a backend config. */
const PICKING_ALERT_MINUTES = 5;

function taskStatusTone(status: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'PENDING': return 'amber';
    case 'ASSIGNED':
    case 'IN_PROGRESS': return 'blue';
    case 'PICKED': return 'green';
    case 'CANCELLED': return 'red';
    default: return 'gray';
  }
}

interface PickerOpsCardProps {
  orderNumber: string;
  orderStatus: string;
  storeId: number;
}

/** Order hasn't been confirmed yet — no pick task can exist, nothing to show. */
const NOT_YET_RELEVANT: string[] = ['PENDING_PAYMENT'];

/**
 * Real picker-lifecycle actions for the order detail page. Actions (assign/reassign) only
 * ever appear while the underlying task is in an actionable state (PENDING/ASSIGNED/
 * IN_PROGRESS), which in practice only overlaps CONFIRMED/PACKING orders — for later order
 * statuses this renders a read-only summary of who picked the order, no actions.
 */
export function PickerOpsCard({ orderNumber, orderStatus, storeId }: PickerOpsCardProps) {
  const [task, setTask] = useState<TaskListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'assign' | 'reassign' | null>(null);

  const relevant = !NOT_YET_RELEVANT.includes(orderStatus);

  const load = useCallback(async () => {
    if (!relevant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setTask(await pickerApi.getTaskForOrder(orderNumber));
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load picker task.');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, relevant]);

  useEffect(() => {
    load();
  }, [load]);

  if (!relevant) return null;

  return (
    <Card>
      <SectionTitle>Picker</SectionTitle>
      {loading ? (
        <Loading label="Loading picker status…" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <PickerOpsBody
          task={task}
          orderStatus={orderStatus}
          onAssign={() => setModalMode('assign')}
          onReassign={() => setModalMode('reassign')}
        />
      )}
      <TaskReassignModal
        open={modalMode !== null}
        mode={modalMode ?? 'assign'}
        task={modalMode === 'reassign' ? task : null}
        orderNumber={modalMode === 'assign' ? orderNumber : undefined}
        storeId={storeId}
        onClose={() => setModalMode(null)}
        onDone={load}
      />
    </Card>
  );
}

function PickerOpsBody({
  task,
  orderStatus,
  onAssign,
  onReassign
}: {
  task: TaskListResponse | null;
  orderStatus: string;
  onAssign: () => void;
  onReassign: () => void;
}) {
  if (!task) {
    // A CONFIRMED order with no task yet is the normal "auto-assignment hasn't run" window —
    // actionable. Any other status with no task is either a pre-picker-feature order or a
    // data anomaly; show a neutral note with no action rather than a misleading "assign" CTA.
    if (orderStatus !== 'CONFIRMED') {
      return (
        <p className="text-sm text-gray-400">No pick task recorded for this order.</p>
      );
    }
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No picker assigned yet — auto-assignment runs within ~60 seconds of confirmation.
        </div>
        <button type="button" className="btn-primary text-sm" onClick={onAssign}>
          Assign Picker
        </button>
      </div>
    );
  }

  if (task.status === 'PENDING') {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Stuck — no picker was available to auto-assign.
        </div>
        <button type="button" className="btn-primary text-sm" onClick={onAssign}>
          Assign Picker
        </button>
      </div>
    );
  }

  if (task.status === 'ASSIGNED') {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={taskStatusTone(task.status)}>{task.status.replace(/_/g, ' ')}</Badge>
          <span className="text-gray-500">Picker #{task.pickerId}</span>
        </div>
        <p className="text-xs text-gray-400">Assigned {formatDate(task.assignedAt ?? undefined)}</p>
        <button type="button" className="btn-primary text-sm" onClick={onReassign}>
          Reassign
        </button>
      </div>
    );
  }

  if (task.status === 'IN_PROGRESS') {
    const stale = (task.elapsedMinutes ?? 0) >= PICKING_ALERT_MINUTES;
    const totalItems = task.processedItemCount != null ? task.processedItemCount + (task.pendingItemCount ?? 0) : null;
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={taskStatusTone(task.status)}>{task.status.replace(/_/g, ' ')}</Badge>
          <span className="text-gray-500">Picker #{task.pickerId}</span>
        </div>
        <p className="text-xs text-gray-400">
          Started {formatDate(task.startedAt ?? undefined)}
          {totalItems != null && <> &middot; {task.processedItemCount}/{totalItems} items</>}
          {task.elapsedMinutes != null && <> &middot; {task.elapsedMinutes}m elapsed</>}
        </p>
        {stale && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Picking longer than expected ({task.elapsedMinutes}m) — consider reassigning.
          </div>
        )}
        <button type="button" className="btn-primary text-sm" onClick={onReassign}>
          Reassign
        </button>
      </div>
    );
  }

  // CANCELLED + order still live → previous auto-assignment exhausted all retries.
  // Admin must be able to manually assign a new picker.
  if (task.status === 'CANCELLED' && (orderStatus === 'CONFIRMED' || orderStatus === 'PACKING')) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge tone="red">CANCELLED</Badge>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Previous assignment was cancelled — the order still needs a picker.
        </div>
        <button type="button" className="btn-primary text-sm" onClick={onAssign}>
          Assign Picker
        </button>
      </div>
    );
  }

  // PICKED / terminal CANCELLED — read-only summary, no actions.
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        <Badge tone={taskStatusTone(task.status)}>{task.status.replace(/_/g, ' ')}</Badge>
        {task.pickerId != null && <span className="text-gray-500">Picker #{task.pickerId}</span>}
      </div>
      {task.completedAt && <p className="text-xs text-gray-400">Completed {formatDate(task.completedAt)}</p>}
    </div>
  );
}
