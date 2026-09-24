'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { OrderItemResponse } from '@/lib/orderAdminTypes';
import { useAuth } from '@/lib/store';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { zraApi, ZraApiError, type ZraDebitNote } from '@/lib/zraApi';
import { Badge, Field, Spinner, useToast } from '@/components/ui';

type LineDraft = { sku: string; productName: string; maxQty: number; qty: number; selected: boolean };

interface DebitNotePanelProps {
  orderNumber: string;
  items?: OrderItemResponse[];
}

function maxQty(item: OrderItemResponse): number {
  const f = item.fulfilledQuantity;
  if (f != null && f > 0) return f;
  return item.orderedQuantity ?? 0;
}

export function DebitNotePanel({ orderNumber, items: itemsProp }: DebitNotePanelProps) {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const canFinance = finance.allowed;

  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [prior, setPrior] = useState<ZraDebitNote[]>([]);
  const [priorLoading, setPriorLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadPrior = useCallback(async () => {
    if (!orderNumber.trim()) {
      setPrior([]);
      return;
    }
    setPriorLoading(true);
    try {
      const rows = await zraApi.listDebitNotes(orderNumber.trim());
      setPrior(Array.isArray(rows) ? rows : []);
    } catch {
      setPrior([]);
    } finally {
      setPriorLoading(false);
    }
  }, [orderNumber]);

  const loadLines = useCallback(async () => {
    if (itemsProp) {
      setLines(
        itemsProp
          .map((i) => ({
            sku: i.sku,
            productName: i.productName,
            maxQty: maxQty(i),
            qty: maxQty(i),
            selected: false
          }))
          .filter((l) => l.maxQty > 0)
      );
      return;
    }
    if (!orderNumber.trim()) {
      setLines([]);
      return;
    }
    setLoadingLines(true);
    try {
      const order = await orderAdminApi.getOrder(orderNumber.trim());
      setLines(
        (order.items ?? [])
          .map((i) => ({
            sku: i.sku,
            productName: i.productName,
            maxQty: maxQty(i),
            qty: maxQty(i),
            selected: false
          }))
          .filter((l) => l.maxQty > 0)
      );
    } catch (err) {
      setLines([]);
      toast.push(
        'error',
        err instanceof OrderAdminApiError ? err.message : 'Could not load order lines for debit note.'
      );
    } finally {
      setLoadingLines(false);
    }
  }, [itemsProp, orderNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadPrior();
    void loadLines();
  }, [loadPrior, loadLines]);

  const selectedLines = useMemo(
    () => lines.filter((l) => l.selected && l.qty > 0).map((l) => ({ sku: l.sku, qty: l.qty })),
    [lines]
  );

  async function handleIssue() {
    if (!canFinance || !orderNumber.trim()) return;
    if (selectedLines.length === 0) {
      toast.push('error', 'Select at least one line with qty > 0.');
      return;
    }
    if (
      !window.confirm(
        `Issue a ZRA debit note for ${orderNumber.trim()} (${selectedLines.length} line(s))? This writes to Smart Invoice and cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const dn = await zraApi.issueDebitNote(
        orderNumber.trim(),
        {
          reasonCd: '01',
          reason: reason.trim() || 'Price adjustment',
          lines: selectedLines
        },
        user?.username
      );
      if (dn.status !== 'ISSUED') {
        toast.push('error', dn.lastError || `Debit note ${dn.status ?? 'failed'}`);
      } else {
        toast.push('success', `Debit note issued invcNo=${dn.invcNo ?? dn.id}`);
      }
      setReason('');
      await loadPrior();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Debit note failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf(id: number) {
    setDownloadingId(id);
    try {
      const blobUrl = await zraApi.fetchDebitNotePdfBlobUrl(id);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `debit-note-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'PDF download failed.');
    } finally {
      setDownloadingId(null);
    }
  }

  if (finance.loading) {
    return <p className="text-xs text-gray-400">Checking ZRA finance access…</p>;
  }
  if (!canFinance) {
    return <ZraFinanceNotice access={finance} />;
  }

  return (
    <div className="space-y-4">
      <Field label="Reason (optional)">
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Price adjustment"
          disabled={busy}
        />
      </Field>
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">Select lines to debit</p>
        {loadingLines ? (
          <p className="text-xs text-gray-400">Loading order lines…</p>
        ) : lines.length === 0 ? (
          <p className="text-xs text-gray-400">No billable lines found for this order.</p>
        ) : (
          <div className="max-h-48 overflow-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 w-8" />
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5">Qty</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.sku} className="border-t border-gray-50">
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={l.selected}
                        disabled={busy}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.sku === l.sku ? { ...row, selected: e.target.checked } : row
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-mono">{l.sku}</div>
                      <div className="text-gray-400">{l.productName}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="input w-20 text-xs"
                        min={1}
                        max={l.maxQty}
                        value={l.qty}
                        disabled={busy || !l.selected}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setLines((prev) =>
                            prev.map((row) =>
                              row.sku === l.sku
                                ? {
                                    ...row,
                                    qty: Number.isFinite(n)
                                      ? Math.min(Math.max(1, Math.floor(n)), row.maxQty)
                                      : 1
                                  }
                                : row
                            )
                          );
                        }}
                      />
                      <span className="ml-1 text-gray-400">/ {l.maxQty}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={busy || selectedLines.length === 0}
        onClick={() => void handleIssue()}
      >
        {busy ? <Spinner className="h-4 w-4" /> : 'Issue debit note'}
      </button>
      <div className="border-t border-gray-100 pt-3">
        <p className="mb-2 text-xs font-medium text-gray-700">Prior debit notes</p>
        {priorLoading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : prior.length === 0 ? (
          <p className="text-xs text-gray-400">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {prior.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                <Badge tone={d.status === 'ISSUED' ? 'green' : d.status === 'FAILED' ? 'red' : 'amber'}>
                  {d.status ?? '—'}
                </Badge>
                <span>
                  DN#{d.seq ?? d.id} · invc {d.invcNo ?? '—'} · {d.debitedAmount ?? '—'}
                </span>
                {d.status === 'ISSUED' && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={downloadingId === d.id}
                    onClick={() => void handleDownloadPdf(d.id)}
                  >
                    {downloadingId === d.id ? '…' : 'PDF'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
