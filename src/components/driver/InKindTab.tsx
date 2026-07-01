'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { InKindDisbursementRecord, InKindSummaryItem } from '@/lib/types';
import { Card, EmptyState, ErrorBox, Loading, SectionTitle, formatDate } from '@/components/ui';

const SKU_LABELS: Record<string, string> = {
  mealie_bag: 'Mealie Bag',
  household_item: 'Household Item',
};

const VALID_SKUS = ['mealie_bag', 'household_item'] as const;

export function InKindTab({ phone, summary }: { phone: string; summary: InKindSummaryItem[] }) {
  const [history, setHistory] = useState<InKindDisbursementRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [sku, setSku] = useState<string>('mealie_bag');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await api.listInKindDisbursements(phone);
      setHistory(res.disbursements);
    } catch (err) {
      setHistoryError(err instanceof ApiClientError ? err.message : 'Failed to load history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [phone]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const outstandingForSku = summary.find((s) => s.sku === sku)?.outstanding ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) {
      setSubmitError('Quantity must be at least 1.');
      return;
    }
    setSubmitting(true);
    try {
      await api.recordInKindDisbursement(phone, { sku, quantity: qty, notes: notes || undefined });
      setSubmitSuccess(`Recorded ${qty} × ${SKU_LABELS[sku] ?? sku} disbursement.`);
      setQuantity('1');
      setNotes('');
      loadHistory();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'OVER_DISBURSEMENT') {
        setSubmitError('Quantity exceeds the outstanding amount for this item.');
      } else {
        setSubmitError(err instanceof ApiClientError ? err.message : 'Failed to record disbursement.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Outstanding summary */}
      {summary.length === 0 ? (
        <Card>
          <EmptyState>No in-kind rewards earned yet.</EmptyState>
        </Card>
      ) : (
        <Card>
          <SectionTitle>Outstanding Rewards</SectionTitle>
          <div className="mt-3 divide-y divide-gray-100">
            {summary.map((item) => (
              <div key={item.sku} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-gray-700">{item.label}</span>
                <div className="flex gap-6 text-right">
                  <span className="text-gray-400">Earned <span className="font-semibold text-gray-700">{item.earned}</span></span>
                  <span className="text-gray-400">Disbursed <span className="font-semibold text-gray-700">{item.disbursed}</span></span>
                  <span className="text-gray-400">Outstanding <span className="font-semibold text-brand-green-dark">{item.outstanding}</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Disbursement form */}
      <Card>
        <SectionTitle>Record Disbursement</SectionTitle>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Item type</label>
            <select
              className="input w-full"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            >
              {VALID_SKUS.map((s) => (
                <option key={s} value={s}>{SKU_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Quantity <span className="text-gray-400">(outstanding: {outstandingForSku})</span>
            </label>
            <input
              type="number"
              min={1}
              max={outstandingForSku}
              className="input w-full"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              className="input w-full"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Collected at depot on 2026-07-02"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          {submitSuccess && <p className="text-sm text-green-700">{submitSuccess}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || outstandingForSku < 1}
          >
            {submitting ? 'Recording…' : 'Record disbursement'}
          </button>
        </form>
      </Card>

      {/* History */}
      <Card className="p-0">
        <div className="px-5 py-4">
          <SectionTitle>Disbursement History</SectionTitle>
        </div>
        {loadingHistory && <div className="p-5"><Loading label="Loading history…" /></div>}
        {historyError && <div className="p-5"><ErrorBox message={historyError} /></div>}
        {!loadingHistory && !historyError && history.length === 0 && (
          <div className="p-5"><EmptyState>No disbursements recorded yet.</EmptyState></div>
        )}
        {!loadingHistory && history.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Notes</th>
                <th className="px-5 py-3 font-medium">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {history.map((rec) => (
                <tr key={rec.disbursement_id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-500">{formatDate(rec.disbursed_at)}</td>
                  <td className="px-5 py-3 text-gray-700">{SKU_LABELS[rec.sku] ?? rec.sku}</td>
                  <td className="px-5 py-3 text-gray-700">{rec.quantity}</td>
                  <td className="px-5 py-3 text-gray-500">{rec.notes || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{rec.disbursed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
