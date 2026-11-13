'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { canConfirmAssignRider, eligibleAssignRiders, type AssignRiderOption } from '@/lib/assignRider';
import type { DriverSummary } from '@/lib/types';
import { Modal } from '@/components/Modal';
import { ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

const MAX_DRIVER_PAGES = 20;

async function loadEligibleRiders(storeId: string): Promise<AssignRiderOption[]> {
  const all: DriverSummary[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_DRIVER_PAGES; page++) {
    const res = await api.listDrivers({ assigned_store_id: storeId, cursor, limit: 100 });
    all.push(...(res.drivers ?? []));
    const next = res.next_cursor?.trim() ?? '';
    if (!next || seen.has(next)) break;
    seen.add(next);
    cursor = next;
  }
  return eligibleAssignRiders(all);
}

export function AssignRiderModal({
  open,
  onClose,
  orderNumber,
  storeId,
  onAssigned
}: {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  storeId: string;
  onAssigned: () => void;
}) {
  const toast = useToast();
  const [riders, setRiders] = useState<AssignRiderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!storeId.trim()) {
      setRiders([]);
      setLoadError('This trip has no store.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setSubmitError(null);
    setSelectedPhone('');
    try {
      setRiders(await loadEligibleRiders(storeId));
    } catch (err) {
      setRiders([]);
      setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load riders.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  const canConfirm = canConfirmAssignRider({
    selectedPhone,
    loading,
    error: loadError,
    riderCount: riders.length
  });

  async function submit() {
    const rider = riders.find((r) => r.phone === selectedPhone);
    if (!rider || !canConfirm) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await api.assignOrder(orderNumber, rider.phone);
      toast.push('success', `Order assigned to ${rider.name || rider.phone}.`);
      onAssigned();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : 'Failed to assign order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign rider">
      <div className="space-y-4">
        {loading ? (
          <Loading label="Loading riders…" />
        ) : loadError ? (
          <ErrorBox message={loadError} />
        ) : riders.length === 0 ? (
          <p className="text-sm text-gray-500">No eligible riders at this store.</p>
        ) : (
          <Field label="Rider">
            <select
              className="input"
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
            >
              <option value="">Select rider…</option>
              {riders.map((r) => (
                <option key={r.phone} value={r.phone}>
                  {r.name} — {r.phone}
                </option>
              ))}
            </select>
          </Field>
        )}
        {submitError && <ErrorBox message={submitError} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Back
          </button>
          <button type="button" className="btn-primary" disabled={!canConfirm || busy} onClick={submit}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Assign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
