'use client';

import { useEffect, useState } from 'react';
import { inventoryApi, InventoryApiError } from '@/lib/inventoryApi';
import type { StoreStockBrowseItem } from '@/lib/inventoryHealthTypes';
import { Modal } from '@/components/Modal';
import { ErrorBox, Field, Spinner, useToast } from '@/components/ui';

interface RelocateStockModalProps {
  open: boolean;
  storeId: number;
  row: StoreStockBrowseItem | null;
  onClose: () => void;
  onDone: () => void;
}

function isStoreroom(code: string | null | undefined): boolean {
  return (code ?? '').trim().toUpperCase() === 'STOREROOM';
}

export function RelocateStockModal({ open, storeId, row, onClose, onDone }: RelocateStockModalProps) {
  const toast = useToast();
  const [toStoreroom, setToStoreroom] = useState(false);
  const [toLocation, setToLocation] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('RELOCATE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromCode = (row?.locationCode ?? '').trim().toUpperCase();
  const fromIsStoreroom = isStoreroom(fromCode);
  const maxQty = row?.availableStock ?? 0;
  const toCode = toStoreroom ? 'STOREROOM' : toLocation.trim().toUpperCase();
  const sameLocation = Boolean(fromCode && toCode && fromCode === toCode);
  const parsedQty = parseInt(qty, 10);

  useEffect(() => {
    if (!open || !row) return;
    setToStoreroom(false);
    setToLocation('');
    setQty(String(row.availableStock > 0 ? row.availableStock : ''));
    setReason('RELOCATE');
    setError(null);
    setBusy(false);
  }, [open, row]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!row || !fromCode) {
      setError('This row has no source location.');
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Enter a positive quantity.');
      return;
    }
    if (parsedQty > maxQty) {
      setError(`Cannot move more than ${maxQty} unreserved units.`);
      return;
    }
    if (!toStoreroom && !toLocation.trim()) {
      setError('Enter a destination shelf location or use storeroom.');
      return;
    }
    if (sameLocation) {
      setError('Destination must be different from the source location.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await inventoryApi.transferStock({
        sku: row.sku,
        storeId,
        quantity: parsedQty,
        reason: reason.trim() || 'RELOCATE',
        fromStoreroom: fromIsStoreroom,
        fromLocationCode: fromIsStoreroom ? undefined : fromCode,
        toStoreroom,
        toLocationCode: toStoreroom ? undefined : toLocation.trim()
      });
      toast.push(
        'success',
        res.idempotent
          ? 'Transfer already recorded.'
          : `Moved ${res.quantityTransferred} from ${res.fromLocationCode} → ${res.toLocationCode}.`
      );
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof InventoryApiError ? err.message : 'Relocate failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Relocate stock">
      {row && (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-900">{row.productName}</span>
              <span className="ml-2 font-mono text-xs text-gray-500">{row.sku}</span>
            </p>
            <p>
              From{' '}
              <span className="font-mono text-xs font-semibold text-gray-900">{fromCode || '—'}</span>
              {' · '}
              <span className="font-semibold text-gray-900">{maxQty}</span> available
              {row.reservedStock > 0 ? (
                <span className="text-gray-400"> ({row.reservedStock} reserved stay put)</span>
              ) : null}
            </p>
          </div>

          {error && <ErrorBox message={error} />}

          {maxQty <= 0 ? (
            <p className="text-sm text-amber-700">
              Nothing transferable at this bin
              {row.reservedStock > 0
                ? ` (${row.reservedStock} reserved, ${row.currentStock} on hand).`
                : '.'}
            </p>
          ) : (
            <>
              <Field label="Quantity" hint={`Max ${maxQty} unreserved units.`}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </Field>

              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Destination</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={toStoreroom}
                    onChange={(e) => setToStoreroom(e.target.checked)}
                    disabled={fromIsStoreroom}
                  />
                  Storeroom
                </label>
                {fromIsStoreroom && (
                  <p className="text-xs text-gray-500">Cannot transfer storeroom → storeroom.</p>
                )}
                {!toStoreroom && (
                  <input
                    className="input font-mono uppercase"
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value.toUpperCase())}
                    placeholder="Shelf code, e.g. A1-S3"
                    required={!toStoreroom}
                    autoFocus
                  />
                )}
              </div>

              {sameLocation && (
                <p className="text-sm text-red-600">
                  Destination is the same as source ({fromCode}). Pick a different location.
                </p>
              )}

              <Field label="Reason">
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || maxQty <= 0 || sameLocation}
            >
              {busy ? <Spinner className="h-4 w-4" /> : 'Relocate'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
