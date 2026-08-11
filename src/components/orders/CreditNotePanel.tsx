'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { OrderItemResponse } from '@/lib/orderAdminTypes';
import { useAuth } from '@/lib/store';
import { isZraFinanceAdmin } from '@/lib/zraFinance';
import { zraApi, ZraApiError, type ZraCreditNote } from '@/lib/zraApi';
import { Badge, Field, Spinner, useToast } from '@/components/ui';

type LineDraft = { sku: string; productName: string; maxQty: number; qty: number; selected: boolean };

interface CreditNotePanelProps {
  orderNumber: string;
  /** When provided, skip loading order for line items. */
  items?: OrderItemResponse[];
  /** Compact layout for embedding in invoice ops. */
  compact?: boolean;
  onIssued?: (note: ZraCreditNote) => void;
}

function maxQty(item: OrderItemResponse): number {
  const f = item.fulfilledQuantity;
  if (f != null && f > 0) return f;
  return item.orderedQuantity ?? 0;
}

function priorCreditedQtyBySku(notes: ZraCreditNote[]): Record<string, number> {
  const qty: Record<string, number> = {};
  for (const note of notes) {
    if (note.status !== 'ISSUED' || !note.lineItemsJson) continue;
    try {
      const lines = JSON.parse(note.lineItemsJson) as { sku?: string; qty?: number }[];
      if (!Array.isArray(lines)) continue;
      for (const line of lines) {
        if (!line?.sku) continue;
        const q = typeof line.qty === 'number' ? line.qty : Number(line.qty);
        if (Number.isFinite(q) && q > 0) {
          qty[line.sku] = (qty[line.sku] ?? 0) + Math.floor(q);
        }
      }
    } catch {
      // ignore malformed prior lines — server still enforces remaining qty
    }
  }
  return qty;
}

function buildLineDrafts(items: OrderItemResponse[], prior: ZraCreditNote[]): LineDraft[] {
  const priorQty = priorCreditedQtyBySku(prior);
  return items
    .map((i) => {
      const fulfilled = maxQty(i);
      const remaining = Math.max(0, fulfilled - (priorQty[i.sku] ?? 0));
      return {
        sku: i.sku,
        productName: i.productName,
        maxQty: remaining,
        qty: remaining,
        selected: false
      };
    })
    .filter((l) => l.maxQty > 0);
}

export function CreditNotePanel({ orderNumber, items: itemsProp, compact = false, onIssued }: CreditNotePanelProps) {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const canFinance = isZraFinanceAdmin(user);

  const [fullCredit, setFullCredit] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [prior, setPrior] = useState<ZraCreditNote[]>([]);
  const [priorLoading, setPriorLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadPrior = useCallback(async () => {
    if (!orderNumber.trim()) {
      setPrior([]);
      return;
    }
    setPriorLoading(true);
    try {
      const rows = await zraApi.listCreditNotes(orderNumber.trim());
      setPrior(Array.isArray(rows) ? rows : []);
    } catch {
      setPrior([]);
    } finally {
      setPriorLoading(false);
    }
  }, [orderNumber]);

  const loadLines = useCallback(async (priorNotes: ZraCreditNote[]) => {
    if (itemsProp) {
      setLines(buildLineDrafts(itemsProp, priorNotes));
      return;
    }
    if (!orderNumber.trim()) {
      setLines([]);
      return;
    }
    setLoadingLines(true);
    try {
      const order = await orderAdminApi.getOrder(orderNumber.trim());
      setLines(buildLineDrafts(order.items ?? [], priorNotes));
    } catch (err) {
      setLines([]);
      toast.push(
        'error',
        err instanceof OrderAdminApiError ? err.message : 'Could not load order lines for partial credit.'
      );
    } finally {
      setLoadingLines(false);
    }
  }, [itemsProp, orderNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadPrior();
  }, [loadPrior]);

  useEffect(() => {
    if (!fullCredit) void loadLines(prior);
  }, [fullCredit, loadLines, prior]);

  const selectedLines = useMemo(
    () => lines.filter((l) => l.selected && l.qty > 0).map((l) => ({ sku: l.sku, qty: l.qty })),
    [lines]
  );

  async function handleIssue() {
    if (!canFinance || !orderNumber.trim()) return;
    if (!fullCredit && selectedLines.length === 0) {
      toast.push('error', 'Select at least one line with qty > 0 for a partial credit.');
      return;
    }
    const issued = prior.filter((c) => c.status === 'ISSUED');
    const priorHint =
      issued.length > 0
        ? `\n\nExisting ISSUED credits: ${issued.length} (amounts: ${issued
            .map((c) => c.creditedAmount ?? '?')
            .join(', ')}). Server caps remaining amount.`
        : '';
    const modeLabel = fullCredit ? 'FULL' : `PARTIAL (${selectedLines.length} line(s))`;
    if (
      !window.confirm(
        `Issue a ${modeLabel} ZRA credit note for ${orderNumber.trim()}? This writes to Smart Invoice and cannot be undone.${priorHint}`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const cn = await zraApi.issueCreditNote(
        orderNumber.trim(),
        {
          reasonCd: '01',
          reason: reason.trim() || 'Customer return / refund',
          fullCredit,
          lines: fullCredit ? undefined : selectedLines
        },
        user?.username
      );
      toast.push(
        'success',
        `Credit note ${cn.status ?? 'submitted'} invcNo=${cn.invcNo ?? cn.id}`
      );
      setReason('');
      setFullCredit(true);
      await loadPrior();
      onIssued?.(cn);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Credit note failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf(id: number) {
    setDownloadingId(id);
    try {
      const blobUrl = await zraApi.fetchCreditNotePdfBlobUrl(id);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `credit-note-${id}.pdf`;
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

  if (!canFinance) {
    return <p className="text-xs text-gray-500">Finance admin only — credit notes are gated.</p>;
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`credit-mode-${orderNumber}`}
            checked={fullCredit}
            onChange={() => setFullCredit(true)}
            disabled={busy}
          />
          Full credit
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`credit-mode-${orderNumber}`}
            checked={!fullCredit}
            onChange={() => setFullCredit(false)}
            disabled={busy}
          />
          Partial credit
        </label>
      </div>

      <Field label="Reason (optional)">
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer return / refund"
          disabled={busy}
        />
      </Field>

      {!fullCredit && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Select lines to credit</p>
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
      )}

      <button
        type="button"
        className="btn-primary text-sm"
        disabled={busy || (!fullCredit && selectedLines.length === 0)}
        onClick={() => void handleIssue()}
      >
        {busy ? <Spinner className="h-4 w-4" /> : fullCredit ? 'Issue full credit note' : 'Issue partial credit note'}
      </button>

      <div className="border-t border-gray-100 pt-3">
        <p className="mb-2 text-xs font-medium text-gray-700">Prior credit notes</p>
        {priorLoading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : prior.length === 0 ? (
          <p className="text-xs text-gray-400">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {prior.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                <Badge tone={c.status === 'ISSUED' ? 'green' : c.status === 'FAILED' ? 'red' : 'amber'}>
                  {c.status ?? '—'}
                </Badge>
                <span>
                  CN#{c.seq ?? c.id} · invc {c.invcNo ?? '—'} · {c.creditedAmount ?? '—'}
                </span>
                {c.status === 'ISSUED' && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={downloadingId === c.id}
                    onClick={() => void handleDownloadPdf(c.id)}
                  >
                    {downloadingId === c.id ? <Spinner className="h-3 w-3" /> : 'PDF'}
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
