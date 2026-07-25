'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, MapPin, UserCog } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import type { Trip, TripTask, ReassignCandidate } from '@/lib/types';
import { REASSIGN_REASONS } from '@/lib/types';
import { Modal } from '@/components/Modal';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  SectionTitle,
  Spinner,
  formatDate,
  money,
  useToast
} from '@/components/ui';

const TRIP_STATUS_TONE: Record<string, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  created: 'gray',
  assigned: 'amber',
  accepted: 'blue',
  out_for_delivery: 'green',
  completed: 'gray',
  cancelled: 'red'
};

function taskLabel(type: TripTask['type']) {
  return type === 'pickup' ? 'Pickup' : 'Drop';
}

export function CurrentTripCard({ phone, refreshKey, onTripChanged }: { phone: string; refreshKey: number; onTripChanged: () => void }) {
  const toast = useToast();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickupBusy, setPickupBusy] = useState(false);
  const [dropModal, setDropModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [reassignModal, setReassignModal] = useState(false);
  const [candidates, setCandidates] = useState<ReassignCandidate[] | null>(null);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedDE, setSelectedDE] = useState<string>('');
  const [reasonCode, setReasonCode] = useState<string>('');
  const [reassignNote, setReassignNote] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDriverTrip(phone);
      setTrip(res.trip);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load trip.');
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const pickup = trip?.tasks.find((t) => t.type === 'pickup');
  const drop = trip?.tasks.find((t) => t.type === 'drop');
  const canMarkPickup = trip?.status === 'accepted' && pickup && pickup.status !== 'completed';
  const canMarkDrop = trip?.status === 'out_for_delivery' && drop && drop.status !== 'completed';
  const canReassign =
    trip?.status === 'assigned' || trip?.status === 'accepted' || trip?.status === 'out_for_delivery';

  async function openReassign() {
    if (!trip) return;
    setReassignError(null);
    setCandidatesError(null);
    setSelectedDE('');
    setReasonCode('');
    setReassignNote('');
    setCandidates(null);
    setReassignModal(true);
    try {
      const res = await api.getReassignCandidates(trip.trip_id);
      setCandidates(res.candidates ?? []);
    } catch (err) {
      setCandidatesError(err instanceof ApiClientError ? err.message : 'Failed to load available riders.');
      setCandidates([]);
    }
  }

  async function submitReassign(e: React.FormEvent) {
    e.preventDefault();
    if (!trip || !selectedDE || !reasonCode) return;
    setReassignBusy(true);
    setReassignError(null);
    try {
      await api.reassignTrip(trip.trip_id, {
        to_de_phone: selectedDE,
        reason_code: reasonCode,
        note: reassignNote.trim() || undefined
      });
      toast.push('success', 'Trip reassigned.');
      setReassignModal(false);
      await load();
      onTripChanged();
    } catch (err) {
      setReassignError(err instanceof ApiClientError ? err.message : 'Failed to reassign trip.');
    } finally {
      setReassignBusy(false);
    }
  }

  async function markPickupDone() {
    if (!canMarkPickup) return;
    setPickupBusy(true);
    try {
      await api.adminCompletePickup(phone);
      toast.push('success', 'Pickup marked done.');
      await load();
      onTripChanged();
    } catch (err) {
      toast.push('error', err instanceof ApiClientError ? err.message : 'Failed to mark pickup done.');
    } finally {
      setPickupBusy(false);
    }
  }

  async function markDropDone(e: React.FormEvent) {
    e.preventDefault();
    if (!canMarkDrop) return;
    const code = otp.trim();
    if (code.length < 4) {
      setDropError('Enter the 4-digit delivery OTP from the customer.');
      return;
    }
    setDropBusy(true);
    setDropError(null);
    try {
      await api.adminCompleteDrop(phone, code);
      toast.push('success', 'Drop marked done.');
      setOtp('');
      setDropModal(false);
      await load();
      onTripChanged();
    } catch (err) {
      setDropError(err instanceof ApiClientError ? err.message : 'Failed to mark drop done.');
    } finally {
      setDropBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <SectionTitle>Current trip</SectionTitle>
        <Loading label="Loading trip…" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <SectionTitle>Current trip</SectionTitle>
        <ErrorBox message={error} />
      </Card>
    );
  }

  if (!trip) {
    return (
      <Card>
        <SectionTitle>Current trip</SectionTitle>
        <EmptyState>No active trip for this driver.</EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <SectionTitle
          action={
            <Badge tone={TRIP_STATUS_TONE[trip.status] ?? 'gray'}>{trip.status.replace(/_/g, ' ')}</Badge>
          }
        >
          Current trip
        </SectionTitle>

        <dl className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Row label="Order" value={trip.order_id} mono />
          <Row label="Trip" value={trip.trip_id} mono />
          <Row label="Store" value={trip.store_id || '—'} />
          <Row label="Assigned" value={formatDate(trip.assigned_at)} />
          {trip.payment?.collect_cash && (
            <Row label="COD to collect" value={money(trip.payment.amount_zmw)} />
          )}
        </dl>

        <div className="space-y-3">
          {trip.tasks.map((task) => (
            <div key={task.task_id} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {taskLabel(task.type)}
                  {task.recipient_name && <span className="font-normal text-gray-500">· {task.recipient_name}</span>}
                </div>
                <Badge tone={task.status === 'completed' ? 'green' : 'amber'}>{task.status}</Badge>
              </div>
              <p className="text-sm text-gray-600">{task.address || '—'}</p>
              {task.phone && <p className="mt-1 text-xs text-gray-400">{task.phone}</p>}
              {task.completed_at && (
                <p className="mt-1 text-xs text-gray-400">Completed {formatDate(task.completed_at)}</p>
              )}
            </div>
          ))}
        </div>

        {(trip.items?.length ?? 0) > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
              <Package className="h-4 w-4 text-gray-400" />
              Items ({trip.items!.length})
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              {trip.items!.map((item, i) => (
                <li key={`${item.sku ?? item.name}-${i}`} className="flex justify-between gap-4">
                  <span>{item.name}</span>
                  <span className="shrink-0 text-gray-400">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(canMarkPickup || canMarkDrop || canReassign) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {canMarkPickup && (
              <button type="button" className="btn-primary" onClick={markPickupDone} disabled={pickupBusy}>
                {pickupBusy ? <Spinner className="h-4 w-4" /> : 'Mark pickup done'}
              </button>
            )}
            {canMarkDrop && (
              <button type="button" className="btn-primary" onClick={() => { setDropError(null); setOtp(''); setDropModal(true); }}>
                Mark drop done
              </button>
            )}
            {canReassign && (
              <button type="button" className="btn-ghost" onClick={openReassign}>
                <UserCog className="mr-1.5 inline h-4 w-4" />
                Reassign to another rider
              </button>
            )}
          </div>
        )}

        {(trip.reassignments?.length ?? 0) > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Reassigned {trip.reassignments!.length}× · last:{' '}
            {REASSIGN_REASONS.find((r) => r.value === trip.reassignments![trip.reassignments!.length - 1].reason_code)
              ?.label ?? trip.reassignments![trip.reassignments!.length - 1].reason_code}{' '}
            by {trip.reassignments![trip.reassignments!.length - 1].admin_username}
          </p>
        )}

        {trip.status === 'assigned' && pickup?.status !== 'completed' && (
          <p className="mt-4 text-xs text-gray-400">Driver must accept the trip before pickup can be marked done.</p>
        )}
      </Card>

      <Modal open={dropModal} onClose={() => setDropModal(false)} title="Mark drop done">
        <form onSubmit={markDropDone} className="space-y-4">
          <p className="text-sm text-gray-500">Ask the customer for their 4-digit delivery OTP.</p>
          {dropError && <ErrorBox message={dropError} />}
          <Field label="Delivery OTP">
            <input
              className="input font-mono tracking-widest"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDropModal(false)} disabled={dropBusy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={dropBusy || otp.length < 4}>
              {dropBusy ? <Spinner className="h-4 w-4" /> : 'Confirm drop'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={reassignModal} onClose={() => setReassignModal(false)} title="Reassign to another rider">
        <form onSubmit={submitReassign} className="flex min-h-0 flex-1 flex-col gap-4">
          {reassignError && <ErrorBox message={reassignError} />}
          {candidatesError && <ErrorBox message={candidatesError} />}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {candidates === null ? (
              <Loading label="Loading available riders…" />
            ) : candidates.length === 0 ? (
              <EmptyState>No available riders on duty at this store.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li key={c.de_id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                        selectedDE === c.phone_number ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reassign-de"
                        value={c.phone_number}
                        checked={selectedDE === c.phone_number}
                        onChange={() => setSelectedDE(c.phone_number)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{c.name || c.phone_number}</span>
                        <span className="block text-xs text-gray-400">
                          {c.phone_number} · {c.status}
                          {c.previously_held && ' · previously held this trip'}
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs ${c.cash_over_limit ? 'font-medium text-red-600' : 'text-gray-400'}`}>
                        {money(c.in_hand_cash_zmw)}
                        {c.cash_over_limit && ' · over cash limit'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Reason">
            <select className="input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="">Select a reason…</option>
              {REASSIGN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Note (optional)">
            <textarea
              className="input"
              rows={2}
              value={reassignNote}
              onChange={(e) => setReassignNote(e.target.value)}
              placeholder="Anything ops should know later"
            />
          </Field>

          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setReassignModal(false)} disabled={reassignBusy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={reassignBusy || !selectedDE || !reasonCode}>
              {reassignBusy ? <Spinner className="h-4 w-4" /> : 'Confirm reassignment'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className={`text-right text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
