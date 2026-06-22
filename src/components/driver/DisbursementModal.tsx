'use client';

import { useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Field, Spinner, ErrorBox, useToast } from '@/components/ui';

export function DisbursementModal({
  open,
  onClose,
  deId,
  phone,
  outstanding,
  onDone
}: {
  open: boolean;
  onClose: () => void;
  deId: string;
  phone: string;
  outstanding?: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    if (!from || !to) {
      setError('Both period dates are required.');
      return;
    }
    if (from > to) {
      setError('Period start must be on or before period end.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.recordDisbursement(deId, { amount_zmw: value, period_from: from, period_to: to, de_phone: phone });
      toast.push('success', `Recorded payout of K${value.toFixed(2)}.`);
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to record disbursement.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record disbursement">
      <form onSubmit={submit} className="space-y-4">
        {typeof outstanding === 'number' && (
          <p className="text-sm text-gray-500">
            Outstanding balance: <span className="font-semibold text-gray-900">K{outstanding.toFixed(2)}</span>
          </p>
        )}
        {error && <ErrorBox message={error} />}
        <Field label="Payout amount (ZMW)">
          <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period from">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Period to">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-gray-400">
          Recording a payout advances the driver&apos;s earnings watermark — outstanding earnings before now will be cleared.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Record payout'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
