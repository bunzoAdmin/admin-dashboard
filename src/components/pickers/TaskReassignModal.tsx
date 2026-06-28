'use client';

import { useEffect, useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { PickerResponse, TaskListResponse } from '@/lib/pickerTypes';
import { Modal } from '@/components/Modal';
import { ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

interface TaskReassignModalProps {
  open: boolean;
  task: TaskListResponse | null;
  storeId: number;
  onClose: () => void;
  onDone: () => void;
}

export function TaskReassignModal({ open, task, storeId, onClose, onDone }: TaskReassignModalProps) {
  const toast = useToast();
  const [pickers, setPickers] = useState<PickerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !task) return;
    setSelectedId('');
    setError(null);
    setLoading(true);
    pickerApi
      .listPickers(storeId, { status: 'AVAILABLE', size: 100 })
      .then((list) => setPickers(list.filter((p) => p.id !== task.pickerId)))
      .catch((err) => setError(err instanceof PickerApiError ? err.message : 'Failed to load pickers.'))
      .finally(() => setLoading(false));
  }, [open, task, storeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    const newPickerId = parseInt(selectedId, 10);
    if (!Number.isFinite(newPickerId)) {
      setError('Select a picker.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pickerApi.reassignTask(task.id, { newPickerId });
      toast.push('success', 'Task reassigned.');
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Reassign failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reassign task">
      {task && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Order <span className="font-medium">{task.orderNumber ?? task.orderUuid}</span> — assign to an available picker.
          </p>
          {error && <ErrorBox message={error} />}
          {loading ? (
            <Loading label="Loading available pickers…" />
          ) : pickers.length === 0 ? (
            <p className="text-sm text-gray-500">No available pickers at this store.</p>
          ) : (
            <Field label="New picker">
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
              {busy ? <Spinner className="h-4 w-4" /> : 'Reassign'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
