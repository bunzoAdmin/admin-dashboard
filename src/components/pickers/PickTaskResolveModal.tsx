'use client';

import { useEffect, useMemo, useState } from 'react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { PickTaskItemResponse, ResolvePickTaskItemRequest, TaskListResponse } from '@/lib/pickerTypes';
import { Modal } from '@/components/Modal';
import { ErrorBox, Spinner, useToast } from '@/components/ui';

export interface OrderLineForResolve {
  sku: string;
  productName: string;
  orderedQuantity: number;
}

interface LineState {
  key: string;
  itemId?: number;
  sku: string;
  productName: string;
  quantity: number;
  status: string;
  action: 'PICKED' | 'UNAVAILABLE';
  pickedQuantity: number;
  readOnly: boolean;
}

interface PickTaskResolveModalProps {
  open: boolean;
  orderNumber: string;
  orderStatus: string;
  task: TaskListResponse | null;
  orderItems: OrderLineForResolve[];
  onClose: () => void;
  onDone: () => void;
}

function clampPickedQty(raw: string, max: number): number {
  if (raw.trim() === '') return 0;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, n));
}

function validatePendingLines(pending: LineState[]): string | null {
  for (const line of pending) {
    if (line.action !== 'PICKED') continue;
    const qty = line.pickedQuantity;
    if (!Number.isFinite(qty) || qty < 1 || qty > line.quantity) {
      return `Invalid quantity for ${line.productName}. Enter 1–${line.quantity}, or mark unavailable.`;
    }
  }
  return null;
}

export function PickTaskResolveModal({
  open,
  orderNumber,
  orderStatus,
  task,
  orderItems,
  onClose,
  onDone
}: PickTaskResolveModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<LineState[]>([]);

  const fallbackItemsKey = useMemo(
    () => orderItems.map((i) => `${i.sku}:${i.orderedQuantity}:${i.productName}`).join('|'),
    [orderItems]
  );

  const humanOnTask = Boolean(
    task?.pickerId && (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS')
  );

  useEffect(() => {
    if (!open || !task?.id) return;
    const taskId = task.id;
    setError(null);
    let cancelled = false;
    async function loadTaskItems() {
      setLoading(true);
      try {
        const detail = await pickerApi.getTaskDetail(taskId);
        if (cancelled) return;
        setLines(
          (detail.items ?? []).map((item: PickTaskItemResponse) => {
            const processed = item.status === 'PICKED' || item.status === 'UNAVAILABLE';
            return {
              key: String(item.id),
              itemId: item.id,
              sku: item.sku,
              productName: item.productName,
              quantity: item.quantity,
              status: item.status,
              action: item.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'PICKED',
              pickedQuantity: processed ? item.pickedQuantity : item.quantity,
              readOnly: processed
            };
          })
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof PickerApiError ? err.message : 'Failed to load pick items.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTaskItems();
    return () => {
      cancelled = true;
    };
  }, [open, task?.id]);

  useEffect(() => {
    if (!open || task?.id) return;
    setError(null);
    setLoading(false);
    setLines(
      orderItems.map((item, index) => ({
        key: `${item.sku}-${index}`,
        sku: item.sku,
        productName: item.productName,
        quantity: item.orderedQuantity,
        status: 'PENDING',
        action: 'PICKED' as const,
        pickedQuantity: item.orderedQuantity,
        readOnly: false
      }))
    );
  }, [open, task?.id, fallbackItemsKey, orderItems]);

  const pendingLines = useMemo(() => lines.filter((l) => !l.readOnly), [lines]);
  const pendingCount = pendingLines.length;
  const allProcessed = lines.length > 0 && pendingCount === 0;
  const totalOrderedUnits = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validatePendingLines(pendingLines);
    if (validationError) {
      setError(validationError);
      return;
    }
    const items: ResolvePickTaskItemRequest[] = pendingLines.map((l) => ({
      itemId: l.itemId,
      sku: l.itemId == null ? l.sku : undefined,
      action: l.action,
      pickedQuantity: l.action === 'PICKED' ? l.pickedQuantity : 0
    }));
    setBusy(true);
    setError(null);
    try {
      await pickerApi.resolvePickTask(orderNumber, { items });
      toast.push('success', 'Pick task resolved — order is ready for delivery.');
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Resolve failed.');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !loading && !busy && lines.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Resolve pick task">
      <form onSubmit={submit} className="space-y-4">
        {lines.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-600">
              Confirm what was packed for each line. Order moves to{' '}
              <span className="font-semibold text-gray-900">READY FOR DELIVERY</span> when complete.
            </p>
            <p className="text-sm font-bold text-gray-900">
              {lines.length} line{lines.length === 1 ? '' : 's'} ·{' '}
              <span className="text-lg">{totalOrderedUnits}</span> units ordered
            </p>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        {humanOnTask && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            A picker is still assigned to this task. Resolving will release them back to AVAILABLE.
          </div>
        )}
        {orderStatus === 'CONFIRMED' && (
          <p className="text-xs text-gray-400">
            The order will move through PACKING internally as part of this resolve.
          </p>
        )}
        {allProcessed && (
          <p className="text-xs text-gray-500">
            All lines are already processed — complete to finalize the pick and move the order to ready
            for delivery.
          </p>
        )}
        {pendingCount > 0 && (
          <p className="text-xs text-gray-400">
            {pendingCount} item{pendingCount === 1 ? '' : 's'} still to confirm. Picked qty below ordered
            triggers the same short-pick refund path as the picker app.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-gray-500">Loading items…</p>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {lines.map((line) => (
              <div key={line.key} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{line.productName}</div>
                    <div className="text-xs text-gray-400 font-mono">{line.sku}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Ordered</p>
                    <p className="text-2xl font-black leading-none text-gray-900">×{line.quantity}</p>
                  </div>
                </div>
                {line.readOnly && (
                  <p className="mt-2 text-xs text-gray-500">
                    Already processed — {line.status.replace(/_/g, ' ').toLowerCase()}
                  </p>
                )}
                {!line.readOnly && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`action-${line.key}`}
                          checked={line.action === 'PICKED'}
                          onChange={() =>
                            updateLine(line.key, {
                              action: 'PICKED',
                              pickedQuantity: line.pickedQuantity || line.quantity
                            })
                          }
                        />
                        Picked
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`action-${line.key}`}
                          checked={line.action === 'UNAVAILABLE'}
                          onChange={() => updateLine(line.key, { action: 'UNAVAILABLE' })}
                        />
                        Unavailable
                      </label>
                      {line.action === 'PICKED' && (
                      <label className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-gray-600">Picked qty</span>
                        <span className="text-gray-400">of {line.quantity}</span>
                        <input
                          type="number"
                          min={1}
                          max={line.quantity}
                          step={1}
                          className="input w-16 font-semibold"
                          value={line.pickedQuantity}
                          onChange={(e) =>
                            updateLine(line.key, {
                              pickedQuantity: clampPickedQty(e.target.value, line.quantity)
                            })
                          }
                        />
                      </label>
                    )}
                    </div>
                    {line.action === 'PICKED' &&
                      line.pickedQuantity > 0 &&
                      line.pickedQuantity < line.quantity && (
                        <p className="text-xs text-amber-700">
                          Short pick — {line.pickedQuantity} of {line.quantity} will adjust inventory and
                          refunds.
                        </p>
                      )}
                  </div>
                )}
              </div>
            ))}
            {lines.length === 0 && <p className="text-sm text-gray-400">No items on this order.</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Complete pick'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
