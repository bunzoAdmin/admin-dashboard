'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import { listStores } from '@/lib/storesApi';
import type { PickerResponse, ShiftResponse, StoreResponse, TaskHistoryEntry } from '@/lib/pickerTypes';
import { resolveLocalMetricsRange, todayIsoLocal } from '@/lib/pickerMetricsRange';
import { formatPickerStatus, formatTime, pickerStatusTone, taskStatusTone } from '@/lib/pickerUtils';
import { PinRevealModal } from '@/components/pickers/PinRevealModal';
import { Badge, Card, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { Modal } from '@/components/Modal';

export default function PickerDetailPage() {
  const params = useParams<{ id: string }>();
  const pickerId = parseInt(params.id, 10);
  const toast = useToast();

  const [picker, setPicker] = useState<PickerResponse | null>(null);
  const [shift, setShift] = useState<ShiftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<string | null>(null);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [confirmOffboard, setConfirmOffboard] = useState(false);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [editName, setEditName] = useState('');
  const [editShiftId, setEditShiftId] = useState<string>('');
  const [editStoreId, setEditStoreId] = useState<string>('');
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [todayTasks, setTodayTasks] = useState<number | null>(null);
  const [todayAvgMinutes, setTodayAvgMinutes] = useState<number | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadTodayStats = useCallback(async (storeId: number, id: number) => {
    try {
      const today = todayIsoLocal();
      const range = resolveLocalMetricsRange({
        period: 'DAY',
        anchorDate: today,
        customFrom: today,
        customTo: today
      });
      const analytics = await pickerApi.getAnalytics(storeId, {
        period: range.period,
        from: range.from,
        toExclusive: range.toExclusive,
        label: range.label,
        calendarFrom: range.calendarFrom,
        calendarTo: range.calendarTo,
        utcOffsetMinutes: range.utcOffsetMinutes
      });
      const row = analytics.pickers.find((p) => p.pickerId === id);
      setTodayTasks(row?.completedTasks ?? 0);
      setTodayAvgMinutes(row?.avgPickMinutes ?? null);
    } catch {
      setTodayTasks(null);
      setTodayAvgMinutes(null);
    }
  }, []);

  const loadHistory = useCallback(async (id: number) => {
    setHistoryLoading(true);
    try {
      const page = await pickerApi.getPickerTasks(id, { page: 0, size: 20, period: 'WEEK' });
      setTaskHistory(page.items);
    } catch {
      setTaskHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!Number.isFinite(pickerId)) return;
    setLoading(true);
    setError(null);
    try {
      const found = await pickerApi.getPicker(pickerId);
      setPicker(found);
      const [shiftList, storeList] = await Promise.all([
        pickerApi.listShifts(found.storeId).catch(() => [] as ShiftResponse[]),
        listStores().catch(() => [] as StoreResponse[])
      ]);
      setShifts(shiftList);
      setStores(storeList);
      setShift(found.shiftId ? shiftList.find((s) => s.id === found.shiftId) ?? null : null);
      setEditName(found.name);
      setEditShiftId(found.shiftId ? String(found.shiftId) : '');
      setEditStoreId(String(found.storeId));
      await Promise.all([loadTodayStats(found.storeId, pickerId), loadHistory(pickerId)]);
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Failed to load picker.');
      setPicker(null);
    } finally {
      setLoading(false);
    }
  }, [pickerId, loadTodayStats, loadHistory]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep shift options in sync when the edit form's store changes.
  useEffect(() => {
    if (!showEdit) return;
    const sid = parseInt(editStoreId, 10);
    if (!Number.isFinite(sid)) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await pickerApi.listShifts(sid);
        if (cancelled) return;
        setShifts(list);
        setEditShiftId((prev) => (prev && list.some((s) => String(s.id) === prev) ? prev : ''));
      } catch {
        if (!cancelled) {
          setShifts([]);
          setEditShiftId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editStoreId, showEdit]);

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
        shiftId: editShiftId ? parseInt(editShiftId, 10) : undefined,
        storeId: editStoreId ? parseInt(editStoreId, 10) : undefined
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

  async function offboardPicker() {
    if (!picker) return;
    setBusy('offboard');
    try {
      const updated = await pickerApi.offboardPicker(picker.id);
      setPicker(updated);
      setConfirmOffboard(false);
      toast.push('success', 'Picker offboarded — login and task assignment are blocked.');
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Offboard failed.');
    } finally {
      setBusy(null);
    }
  }

  async function reactivatePicker() {
    if (!picker) return;
    setBusy('reactivate');
    try {
      const updated = await pickerApi.reactivatePicker(picker.id);
      setPicker(updated);
      toast.push('success', 'Picker reactivated — they can log in again.');
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Reactivate failed.');
    } finally {
      setBusy(null);
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

  const isOffboarded = !!picker?.offboardedAt;

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
            <div className="flex flex-wrap gap-2">
              {isOffboarded && <Badge tone="red">Offboarded</Badge>}
              <Badge tone={pickerStatusTone(picker.status)}>{formatPickerStatus(picker.status)}</Badge>
            </div>
          </div>

          <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Picker ID" value={String(picker.id)} mono />
            <DetailRow label="Store ID" value={String(picker.storeId)} mono />
            <DetailRow label="Shift" value={shiftLabel} />
            <DetailRow label="Employment" value={isOffboarded ? `Offboarded ${formatTime(picker.offboardedAt)}` : 'Active'} />
            <DetailRow label="Updated" value={formatTime(picker.updatedAt)} />
            <DetailRow label="Created" value={formatTime(picker.createdAt)} />
          </Card>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Today</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Tasks completed</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">{todayTasks ?? '—'}</dd>
              </div>
              <div className="card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Avg pick time</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {todayAvgMinutes != null ? `${todayAvgMinutes.toFixed(1)}m` : '—'}
                </dd>
              </div>
            </div>
          </section>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent tasks</h2>
              <p className="text-xs text-gray-500">Completed and cancelled picks from the last week.</p>
            </div>
            {historyLoading ? (
              <div className="p-6">
                <Loading label="Loading task history…" />
              </div>
            ) : taskHistory.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">No recent tasks.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2.5 font-medium">Task</th>
                      <th className="px-4 py-2.5 font-medium">Order</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Completed</th>
                      <th className="px-4 py-2.5 font-medium text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskHistory.map((t) => (
                      <tr key={t.pickTaskId} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/pickers/tasks/${t.pickTaskId}`} className="font-mono text-sm text-brand-green hover:underline">
                            #{t.pickTaskId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {t.orderNumber ? (
                            <Link href={`/orders/${encodeURIComponent(t.orderNumber)}`} className="font-mono text-sm hover:underline">
                              {t.orderNumber}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-gray-400">{t.orderUuid.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={taskStatusTone(t.status)}>{formatPickerStatus(t.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatTime(t.completedAt ?? t.startedAt)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          {t.durationSeconds != null ? `${Math.round(t.durationSeconds / 60)}m` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                  <span className="label">Store</span>
                  <select className="input" value={editStoreId} onChange={e => setEditStoreId(e.target.value)}>
                    {stores.length > 0 ? stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (#{s.id})</option>
                    )) : (
                      <option value={editStoreId}>Store #{editStoreId}</option>
                    )}
                  </select>
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
              <p className="text-sm text-gray-500">Update name, store, or assigned shift for this picker.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Shift actions</h2>
            <p className="text-sm text-gray-500">End-of-shift controls while the picker is still employed.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" disabled={!!busy || isOffboarded} onClick={resetPin}>
                {busy === 'pin' ? <Spinner className="h-4 w-4" /> : 'Reset PIN'}
              </button>
              <button type="button" className="btn-ghost" disabled={!!busy || isOffboarded} onClick={revokeSessions}>
                {busy === 'revoke' ? <Spinner className="h-4 w-4" /> : 'Revoke sessions'}
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={!!busy || isOffboarded || picker.status === 'OFFLINE'}
                onClick={() => setConfirmCheckout(true)}
              >
                Force check-out
              </button>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Employment</h2>
            {isOffboarded ? (
              <>
                <p className="text-sm text-gray-500">
                  This picker has left the job. They cannot log in or receive tasks. Pick history is retained.
                </p>
                <button type="button" className="btn-primary text-sm" disabled={!!busy} onClick={reactivatePicker}>
                  {busy === 'reactivate' ? <Spinner className="h-4 w-4" /> : 'Reactivate picker'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Use when someone leaves the company. Checks them out, revokes sessions, and blocks future login.
                  Fails if they still have an active pick task — reassign or cancel it first.
                </p>
                <button type="button" className="btn-danger" disabled={!!busy} onClick={() => setConfirmOffboard(true)}>
                  {busy === 'offboard' ? <Spinner className="h-4 w-4" /> : 'Offboard picker'}
                </button>
              </>
            )}
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

      <Modal open={confirmOffboard} onClose={() => setConfirmOffboard(false)} title="Offboard picker">
        <p className="mb-4 text-sm text-gray-600">
          Offboard {picker?.name}? They will be checked out, all sessions revoked, and blocked from logging in or receiving tasks.
          History is kept. This fails if they have an active pick task — reassign or cancel it first.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirmOffboard(false)}>
            Cancel
          </button>
          <button type="button" className="btn-danger" disabled={busy === 'offboard'} onClick={offboardPicker}>
            {busy === 'offboard' ? <Spinner className="h-4 w-4" /> : 'Confirm offboard'}
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
