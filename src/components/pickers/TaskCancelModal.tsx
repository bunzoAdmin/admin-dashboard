'use client';

import { useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { TaskListResponse } from '@/lib/pickerTypes';
import { Modal } from '@/components/Modal';
import { ErrorBox, Field, Spinner, useToast } from '@/components/ui';

interface TaskCancelModalProps {
  open: boolean;
  task: TaskListResponse | null;
  onClose: () => void;
  onDone: () => void;
}

export function TaskCancelModal({ open, task, onClose, onDone }: TaskCancelModalProps) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pickerApi.cancelTask(task.id, { reason: trimmed });
      toast.push('success', 'Task cancelled.');
      setReason('');
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Cancel failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cancel pick task">
      {task && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Cancel order <span className="font-medium">{task.orderNumber ?? task.orderUuid}</span>? This cannot be undone.
          </p>
          {error && <ErrorBox message={error} />}
          <Field label="Reason">
            <textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Back
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Cancel task'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
