'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { ShiftResponse } from '@/lib/pickerTypes';
import { formatShiftTime } from '@/lib/pickerUtils';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Modal } from '@/components/Modal';
import { Card, EmptyState, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

interface ShiftForm {
  code: string;
  displayName: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

const EMPTY: ShiftForm = {
  code: '',
  displayName: '',
  startTime: '07:00',
  endTime: '15:00',
  timezone: 'Africa/Lusaka'
};

export default function ShiftsPage() {
  const toast = useToast();
  const { storeId, setStoreId } = useStoreContext();
  const [shifts, setShifts] = useState<ShiftResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftResponse | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoadError(null);
    try {
      setShifts(await pickerApi.listShifts(storeId));
    } catch (err) {
      setLoadError(err instanceof PickerApiError ? err.message : 'Failed to load shifts.');
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(s: ShiftResponse) {
    setEditing(s);
    setForm({
      code: s.code,
      displayName: s.displayName,
      startTime: s.startTime.slice(0, 5),
      endTime: s.endTime.slice(0, 5),
      timezone: s.timezone
    });
    setFormError(null);
    setModalOpen(true);
  }

  function toBackendTime(t: string): string {
    return t.length === 5 ? `${t}:00` : t;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const displayName = form.displayName.trim();
    if (!code || !displayName || !form.startTime || !form.endTime) {
      setFormError('All fields are required.');
      return;
    }
    if (!editing && storeId == null) {
      setFormError('Select a store before creating a shift.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await pickerApi.updateShift(editing.id, {
          code,
          displayName,
          startTime: toBackendTime(form.startTime),
          endTime: toBackendTime(form.endTime),
          timezone: form.timezone.trim() || 'Africa/Lusaka'
        });
        toast.push('success', 'Shift updated.');
      } else {
        await pickerApi.createShift({
          storeId: storeId!,
          code,
          displayName,
          startTime: toBackendTime(form.startTime),
          endTime: toBackendTime(form.endTime),
          timezone: form.timezone.trim() || undefined
        });
        toast.push('success', 'Shift created.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof PickerApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: ShiftResponse) {
    if (!confirm(`Delete shift "${s.displayName}"?`)) return;
    try {
      await pickerApi.deleteShift(s.id);
      toast.push('success', 'Shift deleted.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Store shifts</h1>
          <p className="text-sm text-gray-500">Roster windows assigned when onboarding pickers.</p>
        </div>
        <button type="button" className="btn-primary" disabled={storeId == null} onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add shift
        </button>
      </div>

      <Card>
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {loadError && <ErrorBox message={loadError} />}

      <Card className="overflow-hidden p-0">
        {storeId == null ? (
          <EmptyState>Select a store above to view shifts.</EmptyState>
        ) : shifts === null && !loadError ? (
          <div className="p-6">
            <Loading label="Loading shifts…" />
          </div>
        ) : shifts && shifts.length === 0 ? (
          <EmptyState>No shifts for this store. Add Morning and Evening shifts to get started.</EmptyState>
        ) : shifts ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Timezone</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-3 font-medium">{s.displayName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatShiftTime(s.startTime)} – {formatShiftTime(s.endTime)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.timezone}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="mr-3 text-sm text-brand-green hover:underline" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                      <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => remove(s)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit shift' : 'Add shift'}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <ErrorBox message={formError} />}
          <Field label="Code" hint="UPPER_SNAKE e.g. MORNING, EVENING">
            <input className="input font-mono uppercase" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} required />
          </Field>
          <Field label="Display name">
            <input className="input" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start">
              <input className="input" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} required />
            </Field>
            <Field label="End">
              <input className="input" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} required />
            </Field>
          </div>
          <Field label="Timezone">
            <input className="input" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
