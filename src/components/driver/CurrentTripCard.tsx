'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, MapPin } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import type { Trip, TripTask } from '@/lib/types';
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

        {(canMarkPickup || canMarkDrop) && (
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
          </div>
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
