'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { PickerResponse, ShiftResponse } from '@/lib/pickerTypes';
import { formatPickerStatus, formatTime, pickerStatusTone } from '@/lib/pickerUtils';
import { PinRevealModal } from '@/components/pickers/PinRevealModal';
import { useStoreContext } from '@/components/pickers/StoreSelector';
import { Badge, Card, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { Modal } from '@/components/Modal';

export default function PickerDetailPage() {
  const params = useParams<{ id: string }>();
  const pickerId = parseInt(params.id, 10);
  const { storeId } = useStoreContext();
  const toast = useToast();

  const [picker, setPicker] = useState<PickerResponse | null>(null);
  const [shift, setShift] = useState<ShiftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<string | null>(null);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [editName, setEditName] = useState('');
  const [editShiftId, setEditShiftId] = useState<string>('');
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(pickerId)) return;
    setLoading(true);
    setError(null);
    try {
      const list = await pickerApi.listPickers(storeId, { size: 200 });
      const found = list.find((p) => p.id === pickerId) ?? null;
      if (!found) {
        setError('Picker not found at this store.');
        setPicker(null);
        return;
      }
      setPicker(found);
      const shiftList = await pickerApi.listShifts(storeId).catch(() => [] as ShiftResponse[]);
      setShifts(shiftList);
      if (found.shiftId) {
        setShift(shiftList.find((s) => s.id === found.shiftId) ?? null);
      } else {
        setShift(null);
      }
      setEditName(found.name);
      setEditShiftId(found.shiftId ? String(found.shiftId) : '');
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load picker.');
    } finally {
      setLoading(false);
    }
  }, [pickerId, storeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function resetPin() {
    if (!picker) return;
    setBusy('pin');
    try {
      const res = await pickerApi.resetPin(picker.id);
      setPinModal(res.initialPin);
      toast.push('success', 'PIN reset — share with picker.');
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Reset failed.');
    } finally {
      setBusy(null);
    }
  }

  async function revokeSessions() {
    if (!picker) return;
    setBusy('revoke');
    try {
      await pickerApi.revokeSessions(picker.id);
      toast.push('success', 'All sessions revoked.');
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Revoke failed.');
    } finally {
      setBusy(null);
    }
  }

  async function savePickerEdits() {
    if (!picker) return;
    setSavingEdit(true);
    try {
      const updated = await pickerApi.updatePicker(picker.id, {
        name: editName.trim() || undefined,
        shiftId: editShiftId ? parseInt(editShiftId, 10) : undefined
      });
      setPicker(updated);
      setShift(updated.shiftId ? shifts.find((s) => s.id === updated.shiftId) ?? null : null);
      toast.push('success', 'Picker updated.');
      setShowEdit(false);
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Update failed.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function forceCheckOut() {
    if (!picker) return;
    setBusy('checkout');
    try {
      await pickerApi.forceCheckOut(picker.id);
      toast.push('success', 'Picker checked out.');
      setConfirmCheckout(false);
      await load();
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Check-out failed.');
    } finally {
      setBusy(null);
    }
  }

  const shiftLabel = useMemo(() => {
    if (shift) return `${shift.displayName} (${shift.code})`;
    if (picker?.shiftId) return `#${picker.shiftId}`;
    return '—';
  }, [shift, picker]);

  if (!Number.isFinite(pickerId)) {
    return <ErrorBox message="Invalid picker ID." />;
  }

  return (
    <div className="space-y-6">
      <Link href="/pickers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Back to live ops
      </Link>

      {loading && <Loading label="Loading picker…" />}
      {error && <ErrorBox message={error} />}

      {picker && !loading && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{picker.name}</h1>
              <p className="font-mono text-sm text-gray-500">{picker.phone}</p>
            </div>
            <Badge tone={pickerStatusTone(picker.status)}>{formatPickerStatus(picker.status)}</Badge>
          </div>

          <Card className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Picker ID" value={String(picker.id)} mono />
            <DetailRow label="Store ID" value={String(picker.storeId)} mono />
            <DetailRow label="Shift" value={shiftLabel} />
            <DetailRow label="Updated" value={formatTime(picker.updatedAt)} />
            <DetailRow label="Created" value={formatTime(picker.createdAt)} />
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
              <button type="button" className="btn-ghost text-xs" onClick={() => setShowEdit(v => !v)}>
                {showEdit ? 'Cancel edit' : 'Edit'}
              </button>
            </div>
            {showEdit ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="label">Name</span>
                  <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="label">Shift</span>
                  <select className="input" value={editShiftId} onChange={e => setEditShiftId(e.target.value)}>
                    <option value="">— No shift —</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.displayName} ({s.code})</option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <button type="button" className="btn-primary text-sm" disabled={savingEdit} onClick={savePickerEdits}>
                    {savingEdit ? <Spinner className="h-4 w-4" /> : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Update name or assigned shift for this picker.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Admin actions</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" disabled={!!busy} onClick={resetPin}>
                {busy === 'pin' ? <Spinner className="h-4 w-4" /> : 'Reset PIN'}
              </button>
              <button type="button" className="btn-ghost" disabled={!!busy} onClick={revokeSessions}>
                {busy === 'revoke' ? <Spinner className="h-4 w-4" /> : 'Revoke sessions'}
              </button>
              <button type="button" className="btn-danger" disabled={!!busy || picker.status === 'OFFLINE'} onClick={() => setConfirmCheckout(true)}>
                Force check-out
              </button>
            </div>
          </Card>
        </>
      )}

      <PinRevealModal open={!!pinModal} pin={pinModal} title="New picker PIN" onClose={() => setPinModal(null)} />

      <Modal open={confirmCheckout} onClose={() => setConfirmCheckout(false)} title="Force check-out">
        <p className="mb-4 text-sm text-gray-600">Force this picker off shift? Fails if they have an active pick task.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirmCheckout(false)}>
            Cancel
          </button>
          <button type="button" className="btn-danger" disabled={busy === 'checkout'} onClick={forceCheckOut}>
            {busy === 'checkout' ? <Spinner className="h-4 w-4" /> : 'Confirm check-out'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-sm text-gray-800' : 'mt-0.5 text-sm text-gray-800'}>{value}</dd>
    </div>
  );
}
