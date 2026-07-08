'use client';

import { useEffect, useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { PickerResponse, TaskListResponse } from '@/lib/pickerTypes';
import { Modal } from '@/components/Modal';
import { ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

type PickerActionMode = 'assign' | 'reassign';

interface TaskReassignModalProps {
  open: boolean;
  /** 'reassign' (default) swaps the picker on an existing ASSIGNED/IN_PROGRESS task.
   *  'assign' hands a picker to an order with no task yet, or an existing PENDING task. */
  mode?: PickerActionMode;
  task: TaskListResponse | null;
  /** Required in 'assign' mode — the order may not have a task yet, so there's no task.orderNumber to fall back on. */
  orderNumber?: string;
  storeId: number;
  onClose: () => void;
  onDone: () => void;
}

export function TaskReassignModal({ open, mode = 'reassign', task, orderNumber, storeId, onClose, onDone }: TaskReassignModalProps) {
  const toast = useToast();
  const [pickers, setPickers] = useState<PickerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAssign = mode === 'assign';
  const displayOrderNumber = isAssign ? orderNumber : (task?.orderNumber ?? task?.orderUuid);
  const excludePickerId = isAssign ? null : task?.pickerId;
  const ready = isAssign ? !!orderNumber : !!task;

  useEffect(() => {
    if (!open || !ready) return;
    setSelectedId('');
    setError(null);
    setLoading(true);
    pickerApi
      .listPickers(storeId, { status: 'AVAILABLE', size: 100 })
      .then((list) => setPickers(excludePickerId ? list.filter((p) => p.id !== excludePickerId) : list))
      .catch((err) => setError(err instanceof PickerApiError ? err.message : 'Failed to load pickers.'))
      .finally(() => setLoading(false));
  }, [open, ready, storeId, excludePickerId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const newPickerId = parseInt(selectedId, 10);
    if (!Number.isFinite(newPickerId)) {
      setError('Select a picker.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isAssign) {
        await pickerApi.assignPicker(orderNumber as string, { pickerId: newPickerId });
        toast.push('success', 'Picker assigned.');
      } else {
        await pickerApi.reassignTask((task as TaskListResponse).id, { newPickerId });
        toast.push('success', 'Task reassigned.');
      }
      onDone();
      onClose();
    } catch (err) {
      const fallback = isAssign ? 'Assign failed.' : 'Reassign failed.';
      setError(err instanceof PickerApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isAssign ? 'Assign picker' : 'Reassign task'}>
      {ready && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Order <span className="font-medium">{displayOrderNumber}</span> — assign to an available picker.
          </p>
          {error && <ErrorBox message={error} />}
          {loading ? (
            <Loading label="Loading available pickers…" />
          ) : pickers.length === 0 ? (
            <p className="text-sm text-gray-500">No available pickers at this store.</p>
          ) : (
            <Field label="Picker">
              <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>
                <option value="">Select picker…</option>
                {pickers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.phone})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || pickers.length === 0}>
              {busy ? <Spinner className="h-4 w-4" /> : isAssign ? 'Assign' : 'Reassign'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
