'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { OrderItemResponse, OrderResponse } from '@/lib/orderAdminTypes';
import { useAuth } from '@/lib/store';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { zraApi, ZraApiError, type ZraCreditNote } from '@/lib/zraApi';
import { Badge, Field, Spinner, useToast } from '@/components/ui';

const FEE_SKU = 'SVC-FEES';

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

/** Same bundle ZRA credits as SVC-FEES: grand total minus item total. */
function feesTotal(order: OrderResponse | null): number {
  if (!order) return 0;
  const items = Number(order.itemsTotal ?? 0);
  const grand = Number(order.grandTotal ?? 0);
  if (!Number.isFinite(items) || !Number.isFinite(grand)) return 0;
  const fees = Math.round((grand - items) * 100) / 100;
  return fees > 0 ? fees : 0;
}

function kwacha(n: number): string {
  return `K${n.toFixed(2)}`;
}

function buildLineDrafts(items: OrderItemResponse[], prior: ZraCreditNote[]): LineDraft[] {
  const priorQty = priorCreditedQtyBySku(prior);
  return items
    .filter((i) => i.sku && i.sku !== FEE_SKU)
    .map((i) => {
      const fulfilled = maxQty(i);
      const remaining = Math.max(0, fulfilled - (priorQty[i.sku] ?? 0));
      return {
        sku: i.sku,
        productName: i.productName,
        maxQty: remaining,
        qty: remaining > 0 ? 1 : 0,
        selected: false
      };
    })
    .filter((l) => l.maxQty > 0);
}

export function CreditNotePanel({ orderNumber, items: itemsProp, compact = false, onIssued }: CreditNotePanelProps) {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const canFinance = finance.allowed;

  const [fullCredit, setFullCredit] = useState(true);
  const [includeFees, setIncludeFees] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [orderFees, setOrderFees] = useState(0);
  const [prior, setPrior] = useState<ZraCreditNote[]>([]);
  const [priorLoading, setPriorLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadPrior = useCallback(async () => {
    if (!orderNumber.trim()) {
      setPrior([]);
      return [];
    }
    setPriorLoading(true);
    try {
      const rows = await zraApi.listCreditNotes(orderNumber.trim());
      const list = Array.isArray(rows) ? rows : [];
      setPrior(list);
      return list;
    } catch {
      setPrior([]);
      return [];
    } finally {
      setPriorLoading(false);
    }
  }, [orderNumber]);

    const loadLines = useCallback(async (priorNotes: ZraCreditNote[]) => {
    if (!orderNumber.trim() && !itemsProp) {
      setLines([]);
      setOrderFees(0);
      return;
    }
    setLoadingLines(true);
    try {
      const order = await orderAdminApi.getOrder(orderNumber.trim());
      setOrderFees(feesTotal(order));
      const items = itemsProp ?? order.items ?? [];
      setLines(buildLineDrafts(items, priorNotes));
    } catch (err) {
      if (itemsProp) {
        setLines(buildLineDrafts(itemsProp, priorNotes));
      } else {
        setLines([]);
        toast.push(
          'error',
          err instanceof OrderAdminApiError ? err.message : 'Could not load order lines for credit.'
        );
      }
    } finally {
      setLoadingLines(false);
    }
  }, [itemsProp, orderNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void (async () => {
      const notes = await loadPrior();
      await loadLines(notes);
    })();
  }, [loadPrior, loadLines]);

  const selectedLines = useMemo(
    () => lines.filter((l) => l.selected && l.qty > 0).map((l) => ({ sku: l.sku, qty: l.qty })),
    [lines]
  );

  const priorQty = useMemo(() => priorCreditedQtyBySku(prior), [prior]);
  const feesCredited = (priorQty[FEE_SKU] ?? 0) > 0;
  const feesOutstanding = orderFees > 0 && !feesCredited;
  const hasRemainingGoods = lines.length > 0;
  const canCreditFeesOnly = includeFees && feesOutstanding && !hasRemainingGoods;
  const canIssue = hasRemainingGoods || canCreditFeesOnly;

  useEffect(() => {
    if (!hasRemainingGoods) {
      setFullCredit(true);
    }
  }, [hasRemainingGoods]);

  async function handleIssue() {
    if (!canFinance || !orderNumber.trim()) return;
    if (!fullCredit && selectedLines.length === 0 && !canCreditFeesOnly) {
      toast.push('error', 'Select at least one line with qty > 0 for a partial credit.');
      return;
    }
    if (!canIssue) {
      toast.push('error', 'Item qty is fully credited. Delivery and service fees stay on the invoice.');
      return;
    }

    const feeLine = feesOutstanding
      ? includeFees
        ? `\n\nALSO crediting delivery and service fees ${kwacha(orderFees)}. This is a tax credit of charges Bunzo normally keeps.`
        : `\n\nDelivery and service fees ${kwacha(orderFees)} — not credited (Bunzo keeps charges).`
      : feesCredited
        ? '\n\nDelivery and service fees were already credited.'
        : '';

    const goodsLabel = fullCredit
      ? hasRemainingGoods
        ? lines.map((l) => `${l.productName || l.sku} × ${l.maxQty}`).join(', ')
        : 'no remaining items'
      : selectedLines.map((l) => `${l.sku} × ${l.qty}`).join(', ');

    const issued = prior.filter((c) => c.status === 'ISSUED');
    const priorHint =
      issued.length > 0
        ? `\nExisting ISSUED credits: ${issued.length} (amounts: ${issued
            .map((c) => c.creditedAmount ?? '?')
            .join(', ')}).`
        : '';
    const modeLabel = fullCredit
      ? `FULL remaining items (${goodsLabel})`
      : `PARTIAL (${selectedLines.length} line(s): ${goodsLabel})`;
    if (
      !window.confirm(
        `Issue a ${modeLabel} ZRA credit note for ${orderNumber.trim()}? This writes to Smart Invoice and cannot be undone.${feeLine}${priorHint}`
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
          includeFees,
          lines: fullCredit ? undefined : selectedLines
        },
        user?.username
      );
      if (cn.status !== 'ISSUED') {
        toast.push('error', cn.lastError || `Credit note ${cn.status ?? 'failed'}`);
      } else {
        toast.push('success', `Credit note issued invcNo=${cn.invcNo ?? cn.id}`);
      }
      setReason('');
      setFullCredit(true);
      setIncludeFees(false);
      const notes = await loadPrior();
      await loadLines(notes);
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

  if (finance.loading) {
    return <p className="text-xs text-gray-400">Checking ZRA finance access…</p>;
  }

  if (!canFinance) {
    return <ZraFinanceNotice access={finance} />;
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
            disabled={busy || !hasRemainingGoods}
          />
          Full remaining items
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`credit-mode-${orderNumber}`}
            checked={!fullCredit}
            onChange={() => setFullCredit(false)}
            disabled={busy || !hasRemainingGoods}
          />
          Partial credit
        </label>
      </div>

      {!hasRemainingGoods && (
        <p className="text-xs text-gray-600">
          Item qty is fully credited. Delivery and service fees stay on the invoice
          {feesOutstanding ? ` (${kwacha(orderFees)})` : ''}.
        </p>
      )}

      <Field label="Reason (optional)">
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer return / refund"
          disabled={busy}
        />
      </Field>

      {orderFees > 0 && (
        <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <div className="font-medium">Delivery and service fees {kwacha(orderFees)}</div>
          {feesCredited ? (
            <p className="mt-1 text-gray-500">Already credited on a prior note.</p>
          ) : (
            <>
              <p className="mt-1 text-gray-500">
                Not refunded. Left on the original invoice unless you opt in below.
              </p>
              <label className="mt-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={includeFees}
                  disabled={busy || feesCredited}
                  onChange={(e) => setIncludeFees(e.target.checked)}
                />
                <span>
                  Also credit delivery and service fees on ZRA (tax exception — charges we normally keep)
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {!fullCredit && hasRemainingGoods && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Select lines to credit</p>
          {loadingLines ? (
            <p className="text-xs text-gray-400">Loading order lines…</p>
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
        disabled={busy || !canIssue || (!fullCredit && selectedLines.length === 0 && !canCreditFeesOnly)}
        onClick={() => void handleIssue()}
      >
        {busy ? (
          <Spinner className="h-4 w-4" />
        ) : fullCredit ? (
          'Issue remaining-item credit note'
        ) : (
          'Issue partial credit note'
        )}
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
