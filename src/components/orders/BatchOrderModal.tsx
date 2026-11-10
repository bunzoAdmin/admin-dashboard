'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import {
  buildBatchExpectedUpdatedAt,
  isAppTooOldError,
  isBatchingDisabledError,
  isStaleMergeError
} from '@/lib/batchOrder';
import type { BatchCandidate, BatchCandidatesResponse } from '@/lib/types';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';

export function BatchOrderModal({
  open,
  onClose,
  orderNumber,
  onBatched,
  onBatchingDisabled
}: {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  onBatched: () => void;
  onBatchingDisabled?: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<BatchCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BatchCandidate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const onCloseRef = useRef(onClose);
  const onDisabledRef = useRef(onBatchingDisabled);
  onCloseRef.current = onClose;
  onDisabledRef.current = onBatchingDisabled;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBatchCandidates(orderNumber);
      setData(res);
    } catch (err) {
      if (isBatchingDisabledError(err)) {
        onDisabledRef.current?.();
        onCloseRef.current();
        return;
      }
      setData(null);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load riders.');
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setConfirming(false);
      setError(null);
      setData(null);
      return;
    }
    load();
  }, [open, load]);

  function pickCandidate(candidate: BatchCandidate) {
    if (!candidate.app_ok) return;
    setSelected(candidate);
    setConfirming(true);
  }

  function backToList() {
    setConfirming(false);
    setSelected(null);
  }

  async function confirmBatch() {
    if (!selected || !selected.app_ok || !data) return;
    setBusy(true);
    try {
      await api.batchOrder(orderNumber, {
        target_de_phone: selected.phone,
        expected_updated_at: buildBatchExpectedUpdatedAt(selected, data)
      });
      toast.push('success', 'Batched');
      onClose();
      onBatched();
    } catch (err) {
      if (isStaleMergeError(err)) {
        toast.push('error', 'Trip changed, pick again');
        backToList();
        await load();
        return;
      }
      if (isAppTooOldError(err)) {
        toast.push('error', 'App too old');
        backToList();
        await load();
        return;
      }
      toast.push('error', err instanceof ApiClientError ? err.message : 'Failed to batch order.');
    } finally {
      setBusy(false);
    }
  }

  const candidates = data?.candidates ?? [];

  return (
    <Modal open={open} onClose={onClose} title={confirming ? 'Batch this order?' : 'Batch onto a rider'}>
      {confirming && selected ? (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">Are you sure?</p>
          {data?.source_rider_name && (
            <p className="text-sm text-gray-600">This takes the order off {data.source_rider_name}.</p>
          )}
          {selected.cash_exceeds && (
            <p className="text-sm text-gray-600">This rider will exceed the cash cap.</p>
          )}
          <p className="text-xs text-gray-400">
            {selected.name || selected.phone} · {selected.phone}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={backToList} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={confirmBatch} disabled={busy || !selected.app_ok}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Batch'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {error && <ErrorBox message={error} />}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <Loading label="Loading riders…" />
            ) : error ? null : candidates.length === 0 ? (
              <EmptyState>No riders on a live trip at this store.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {candidates.map((c) => {
                  const disabled = !c.app_ok;
                  return (
                    <li key={c.phone}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => pickCandidate(c)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left ${
                          disabled
                            ? 'cursor-not-allowed border-gray-100 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {c.name || c.phone}
                          </span>
                          <span className="block text-xs text-gray-400">{c.phone}</span>
                        </span>
                        {disabled && <span className="shrink-0 text-xs text-gray-400">App too old</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex shrink-0 justify-end">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
