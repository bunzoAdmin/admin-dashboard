'use client';

import { useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Field, Spinner, ErrorBox, useToast } from '@/components/ui';

export function CashDepositModal({
  open,
  onClose,
  phone,
  inHandCash,
  onDone
}: {
  open: boolean;
  onClose: () => void;
  phone: string;
  inHandCash: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAmount('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.recordCashDeposit(phone, { amount_zmw: value, deposit_id: crypto.randomUUID() });
      toast.push('success', `Recorded cash deposit of K${value.toFixed(2)}.`);
      reset();
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to record deposit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record cash deposit">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Driver currently holds <span className="font-semibold text-gray-900">K{inHandCash.toFixed(2)}</span> in COD cash.
        </p>
        {error && <ErrorBox message={error} />}
        <Field label="Deposit amount (ZMW)">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Record deposit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
