'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  SectionTitle,
  Spinner,
  formatDate,
  money,
  useToast
} from '@/components/ui';
import { useAuth } from '@/lib/store';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { SkuPicker } from '@/components/zra/SkuPicker';
import {
  useZraStore,
  ZraStoreSelector
} from '@/components/zra/ZraStoreSelector';
import {
  zraApi,
  ZraApiError,
  type ZraItemRegistrationStatus,
  type ZraPurchase,
  type ZraPurchaseDetail
} from '@/lib/zraApi';

type Tab = 'pending' | 'manual';

function statusTone(status?: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'APPROVED':
      return 'green';
    case 'PENDING_APPROVAL':
      return 'amber';
    case 'REJECTED':
    case 'FAILED':
      return 'red';
    default:
      return 'gray';
  }
}

/** Format ZRA purchase date from VSDC (`yyyyMMdd` or `yyyyMMddHHmmss`). */
function formatPurchaseDate(pchsDt?: string | null): string {
  if (!pchsDt) return '—';
  const d = pchsDt.trim();
  if (/^\d{8}$/.test(d)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  if (/^\d{14}$/.test(d)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
  }
  return d;
}

const PMT_TYPES = [
  { cd: '01', label: '01 — Cash' },
  { cd: '02', label: '02 — Credit' },
  { cd: '03', label: '03 — Cash / credit' },
  { cd: '04', label: '04 — Bank / cheque' },
  { cd: '05', label: '05 — Card' },
  { cd: '06', label: '06 — Mobile money' }
] as const;

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type ManualFormLine = {
  itemCd: string;
  itemNm: string;
  qty: string;
  unitPriceInclusive: string;
};

const emptyManualLine = (): ManualFormLine => ({
  itemCd: '',
  itemNm: '',
  qty: '1',
  unitPriceInclusive: ''
});

/** Digits only; empty while editing so 0 does not trap the caret. */
function sanitizeQtyDraft(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  return String(parseInt(digits, 10));
}

function sanitizeMoneyDraft(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot < 0) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
}

export default function ZraPurchasesPage() {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const { storeId, storeIdParam, validStore, setStoreId } = useZraStore();
  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<ZraPurchase[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ZraPurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paperReceiptRef, setPaperReceiptRef] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [lineSkuDraft, setLineSkuDraft] = useState<Record<number, string>>({});
  const [lineQtyDraft, setLineQtyDraft] = useState<Record<number, string>>({});
  const [lineRegStatus, setLineRegStatus] = useState<
    Record<number, ZraItemRegistrationStatus | 'loading' | 'error'>
  >({});
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [manual, setManual] = useState({
    spplrNm: '',
    spplrTpin: '',
    spplrBhfId: '000',
    spplrInvcNo: '',
    pchsDt: todayIsoDate(),
    pmtTyCd: '01',
    remark: '',
    paperReceiptRef: '',
    lines: [emptyManualLine()]
  });
  const [manualSaving, setManualSaving] = useState(false);

  const storeFilter = storeIdParam;

  const load = useCallback(async () => {
    if (storeFilter == null) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === 'pending') {
        // Include FAILED so VSDC transmit failures can be retried.
        const [pending, failed] = await Promise.all([
          zraApi.listPurchases({ status: 'PENDING_APPROVAL', storeId: storeFilter, page: 0, size: 50 }),
          zraApi.listPurchases({ status: 'FAILED', storeId: storeFilter, page: 0, size: 50 })
        ]);
        const merged = [...(pending.content ?? []), ...(failed.content ?? [])];
        setRows(merged);
        setTotal(merged.length);
      } else {
        const result = await zraApi.listPurchases({
          source: 'MANUAL',
          storeId: storeFilter,
          page,
          size: 20
        });
        setRows(result.content ?? []);
        setTotal(result.totalElements ?? 0);
      }
    } catch (err) {
      setError(err instanceof ZraApiError ? err.message : 'Failed to load purchases.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, storeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id: number) {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setPaperReceiptRef('');
    setRejectReason('');
    try {
      const d = await zraApi.getPurchase(id);
      setDetail(d);
      if (d.purchase.storeId != null) setStoreId(d.purchase.storeId);
      setPaperReceiptRef(d.purchase.paperReceiptRef ?? '');
      const drafts: Record<number, string> = {};
      const qtys: Record<number, string> = {};
      for (const line of d.lines) {
        drafts[line.id] = line.itemCd ?? '';
        const q = line.approvedQty ?? line.retrievedQty;
        qtys[line.id] = q != null ? String(q) : '';
      }
      setLineSkuDraft(drafts);
      setLineQtyDraft(qtys);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Failed to load purchase.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleFetch() {
    if (!validStore || storeIdParam == null) {
      toast.push('error', 'Select a store to fetch purchases from its VSDC.');
      return;
    }
    setFetching(true);
    try {
      await zraApi.fetchPurchases(storeIdParam, user?.username);
      toast.push('success', `Purchases fetched from store ${storeIdParam} VSDC.`);
      setPage(0);
      await load();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Fetch failed.');
    } finally {
      setFetching(false);
    }
  }

  async function handleApprove() {
    if (!selectedId || !detail) return;
    const sid = detail.purchase.storeId ?? storeIdParam;
    if (sid == null) {
      toast.push('error', 'Select a store.');
      return;
    }
    const qtyByLine: Record<number, number> = {};
    let accepted = 0;
    let rejected = 0;
    for (const line of detail.lines) {
      const raw = (lineQtyDraft[line.id] ?? '').trim();
      const retrieved = Number(line.retrievedQty ?? 0);
      const qty = raw === '' ? retrieved : Number(raw);
      if (!Number.isFinite(qty) || qty < 0) {
        toast.push('error', `Line ${line.itemSeq}: accept qty must be 0 or more.`);
        return;
      }
      if (qty > retrieved + 1e-9) {
        toast.push('error', `Line ${line.itemSeq}: accept qty cannot exceed retrieved ${retrieved}.`);
        return;
      }
      if (qty > 0 && !(line.itemCd || '').trim()) {
        toast.push('error', `Line ${line.itemSeq} is accepted — map it to a Bunzo SKU first.`);
        return;
      }
      qtyByLine[line.id] = qty;
      if (qty > 0) accepted += 1;
      else rejected += 1;
    }
    if (accepted === 0) {
      toast.push('error', 'Every line is qty 0. Use Reject for the whole purchase.');
      return;
    }
    const summary =
      rejected > 0
        ? `Approve ${accepted} line(s) and reject ${rejected} line(s) on purchase #${selectedId}?`
        : `Approve all ${accepted} line(s) on purchase #${selectedId} for store ${sid}?`;
    if (!window.confirm(summary)) return;
    setBusyAction('approve');
    try {
      await zraApi.approvePurchase(
        selectedId,
        {
          storeId: sid,
          paperReceiptRef: paperReceiptRef.trim() || undefined,
          approvedQtyByLineId: qtyByLine
        },
        user?.username
      );
      toast.push('success', `Purchase #${selectedId} approved (${accepted} accepted, ${rejected} rejected).`);
      setSelectedId(null);
      setDetail(null);
      await load();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Approve failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    if (!selectedId) return;
    if (!window.confirm(`Reject purchase #${selectedId}?`)) return;
    setBusyAction('reject');
    try {
      await zraApi.rejectPurchase(selectedId, rejectReason.trim() || 'Rejected by admin', user?.username);
      toast.push('success', `Purchase #${selectedId} rejected.`);
      setSelectedId(null);
      setDetail(null);
      await load();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Reject failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMapLine(lineId: number) {
    if (!selectedId) return;
    const sku = (lineSkuDraft[lineId] ?? '').trim();
    if (!sku) {
      toast.push('error', 'Select a SKU to map.');
      return;
    }
    setBusyAction(`map-${lineId}`);
    try {
      await zraApi.mapPurchaseLine(selectedId, lineId, sku, user?.username);
      toast.push('success', `Line mapped to ${sku}.`);
      await openDetail(selectedId);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Map line failed.');
    } finally {
      setBusyAction(null);
    }
  }

  /** Best-effort check of whether a mapped SKU is already registered with ZRA — informational only,
   *  approval doesn't require registration up front (registration can also happen lazily on delivery). */
  async function checkLineRegistration(lineId: number, sku: string) {
    if (!validStore || storeIdParam == null || !sku) return;
    setLineRegStatus((s) => ({ ...s, [lineId]: 'loading' }));
    try {
      const status = await zraApi.getItemRegistrationStatus(sku, storeIdParam);
      setLineRegStatus((s) => ({ ...s, [lineId]: status }));
    } catch {
      setLineRegStatus((s) => ({ ...s, [lineId]: 'error' }));
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    if (!validStore || storeIdParam == null) {
      toast.push('error', 'Select a store for the manual purchase.');
      return;
    }
    const sid = storeIdParam;
    if (!manual.spplrNm.trim()) {
      toast.push('error', 'Supplier name is required.');
      return;
    }
    if (!/^\d{10}$/.test(manual.spplrTpin.trim())) {
      toast.push('error', 'Supplier TPIN must be 10 digits (not the dummy customer TPIN 1000000000).');
      return;
    }
    if (manual.spplrTpin.trim() === '1000000000') {
      toast.push('error', 'Use the supplier TPIN, not the dummy B2C customer TPIN 1000000000.');
      return;
    }
    if (!/^\d{1,18}$/.test(manual.spplrInvcNo.trim())) {
      toast.push('error', 'Supplier invoice number must be digits only (e.g. 24501).');
      return;
    }
    const lines = manual.lines.filter((l) => l.itemCd.trim() && Number(l.qty) > 0);
    if (lines.length === 0) {
      toast.push('error', 'Add at least one line and pick a Bunzo SKU.');
      return;
    }
    for (const l of lines) {
      if (!(Number(l.unitPriceInclusive) > 0)) {
        toast.push('error', `Enter a VAT-inclusive unit price for ${l.itemNm || l.itemCd}.`);
        return;
      }
    }
    if (
      !window.confirm(
        `Post manual purchase for store ${sid} (${lines.length} line(s)) to Smart Invoice? This also records ZRA stock-in for those SKUs and cannot be undone.`
      )
    ) {
      return;
    }
    setManualSaving(true);
    try {
      const created = await zraApi.createManualPurchase(
        {
          storeId: sid,
          spplrNm: manual.spplrNm || undefined,
          spplrTpin: manual.spplrTpin || undefined,
          spplrBhfId: manual.spplrBhfId || undefined,
          spplrInvcNo: manual.spplrInvcNo || undefined,
          pchsDt: manual.pchsDt || undefined,
          pmtTyCd: manual.pmtTyCd || undefined,
          remark: manual.remark || undefined,
          paperReceiptRef: manual.paperReceiptRef || undefined,
          lines: lines.map((l) => ({
            itemCd: l.itemCd.trim(),
            itemNm: (l.itemNm || l.itemCd).trim(),
            qty: Number(l.qty),
            unitPriceInclusive: Number(l.unitPriceInclusive)
          }))
        },
        user?.username
      );
      if (created.status === 'FAILED') {
        toast.push(
          'error',
          `Purchase #${created.id} saved but ZRA rejected it: ${created.lastError || created.status}`
        );
      } else {
        toast.push(
          'success',
          `Manual purchase #${created.id} ${created.status}. ZRA stock-in posted for mapped SKUs.`
        );
      }
      setManual({
        spplrNm: '',
        spplrTpin: '',
        spplrBhfId: '000',
        spplrInvcNo: '',
        pchsDt: todayIsoDate(),
        pmtTyCd: '01',
        remark: '',
        paperReceiptRef: '',
        lines: [emptyManualLine()]
      });
      setTab('manual');
      setPage(0);
      await load();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Manual purchase failed.');
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ZRA Purchases</h1>
          <p className="text-sm text-gray-500">Fetch VSDC purchases, approve/reject, map lines, or create manual entries.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-end gap-2">
            <ZraStoreSelector storeId={storeId} onStoreChange={setStoreId} />
            <button
              type="button"
              className="btn-primary"
              onClick={handleFetch}
              disabled={finance.loading || !finance.allowed || !validStore || fetching}
            >
              {fetching ? <Spinner className="h-4 w-4" /> : 'Fetch purchases'}
            </button>
          </div>
          <ZraFinanceNotice access={finance} />
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <Card>
        <div className="border-b border-gray-200">
          <div className="flex gap-1">
            {(
              [
                { id: 'pending' as const, label: 'Pending' },
                { id: 'manual' as const, label: 'Manual' }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(0);
                  setSelectedId(null);
                  setDetail(null);
                }}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'border-brand-green text-brand-green-dark'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3" />

        {tab === 'manual' && (
          <form onSubmit={handleManual} className="mt-4 space-y-4 border-b border-gray-100 pb-5">
            <SectionTitle>Create manual purchase</SectionTitle>
            <p className="text-sm text-gray-500">
              Record a supplier invoice that did not come through ZRA fetch. Each line must be a Bunzo SKU
              already on the ZRA mapping page — that is what lets us post stock-in to Smart Invoice.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Store">
                <p className="input cursor-default bg-gray-50 text-gray-700">
                  {validStore && storeId != null ? `#${storeId} (from selector above)` : 'Select a store above'}
                </p>
              </Field>
              <Field label="Supplier name">
                <input
                  className="input"
                  required
                  value={manual.spplrNm}
                  onChange={(e) => setManual((m) => ({ ...m, spplrNm: e.target.value }))}
                  placeholder="e.g. Trade Kings"
                />
              </Field>
              <Field label="Supplier TPIN" hint="10-digit supplier TPIN — not 1000000000">
                <input
                  className="input font-mono"
                  required
                  inputMode="numeric"
                  maxLength={10}
                  value={manual.spplrTpin}
                  onChange={(e) => setManual((m) => ({ ...m, spplrTpin: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="1000000001"
                />
              </Field>
              <Field label="Supplier branch ID" hint="Usually 000">
                <input
                  className="input font-mono"
                  maxLength={3}
                  value={manual.spplrBhfId}
                  onChange={(e) => setManual((m) => ({ ...m, spplrBhfId: e.target.value }))}
                  placeholder="000"
                />
              </Field>
              <Field label="Supplier invoice number" hint="Digits only">
                <input
                  className="input font-mono"
                  required
                  inputMode="numeric"
                  value={manual.spplrInvcNo}
                  onChange={(e) => setManual((m) => ({ ...m, spplrInvcNo: e.target.value.replace(/\D/g, '') }))}
                  placeholder="24501"
                />
              </Field>
              <Field label="Purchase date">
                <input
                  className="input"
                  type="date"
                  required
                  value={manual.pchsDt}
                  onChange={(e) => setManual((m) => ({ ...m, pchsDt: e.target.value }))}
                />
              </Field>
              <Field label="Payment type">
                <select
                  className="input"
                  value={manual.pmtTyCd}
                  onChange={(e) => setManual((m) => ({ ...m, pmtTyCd: e.target.value }))}
                >
                  {PMT_TYPES.map((p) => (
                    <option key={p.cd} value={p.cd}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Paper receipt ref">
                <input
                  className="input"
                  value={manual.paperReceiptRef}
                  onChange={(e) => setManual((m) => ({ ...m, paperReceiptRef: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Remark">
                <input
                  className="input"
                  value={manual.remark}
                  onChange={(e) => setManual((m) => ({ ...m, remark: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-800">Items</div>
                <p className="text-xs text-gray-500">
                  Search and pick a product. Quantity and VAT-inclusive unit price are required.
                </p>
              </div>
              {manual.lines.map((line, idx) => {
                const qty = Number(line.qty) || 0;
                const price = Number(line.unitPriceInclusive) || 0;
                const lineTotal = qty * price;
                return (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
                      <div className="lg:col-span-4">
                        <SkuPicker
                          label="SKU"
                          value={line.itemCd}
                          placeholder="Search name or SKU…"
                          onChange={(sku, product) =>
                            setManual((m) => {
                              const lines = [...m.lines];
                              lines[idx] = {
                                ...lines[idx],
                                itemCd: sku,
                                itemNm: product?.name ?? (sku === lines[idx].itemCd ? lines[idx].itemNm : '')
                              };
                              return { ...m, lines };
                            })
                          }
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <Field label="Product name">
                          <input
                            className="input bg-white"
                            value={line.itemNm}
                            readOnly
                            placeholder="Filled when you pick a SKU"
                          />
                        </Field>
                      </div>
                      <div className="lg:col-span-1">
                        <Field label="Qty">
                          <input
                            className="input bg-white"
                            inputMode="numeric"
                            autoComplete="off"
                            value={line.qty}
                            onChange={(e) =>
                              setManual((m) => {
                                const lines = [...m.lines];
                                lines[idx] = { ...lines[idx], qty: sanitizeQtyDraft(e.target.value) };
                                return { ...m, lines };
                              })
                            }
                          />
                        </Field>
                      </div>
                      <div className="lg:col-span-2">
                        <Field label="Unit price (K, VAT incl.)">
                          <input
                            className="input bg-white"
                            inputMode="decimal"
                            autoComplete="off"
                            value={line.unitPriceInclusive}
                            onChange={(e) =>
                              setManual((m) => {
                                const lines = [...m.lines];
                                lines[idx] = {
                                  ...lines[idx],
                                  unitPriceInclusive: sanitizeMoneyDraft(e.target.value)
                                };
                                return { ...m, lines };
                              })
                            }
                          />
                        </Field>
                      </div>
                      <div className="flex items-end justify-between gap-2 lg:col-span-2">
                        <Field label="Line total" className="flex-1">
                          <p className="input cursor-default bg-white tabular-nums text-gray-700">
                            {money(lineTotal)}
                          </p>
                        </Field>
                        {manual.lines.length > 1 && (
                          <button
                            type="button"
                            className="btn-ghost mb-0.5 px-2 py-2 text-xs text-red-600"
                            onClick={() =>
                              setManual((m) => ({
                                ...m,
                                lines: m.lines.filter((_, i) => i !== idx)
                              }))
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setManual((m) => ({ ...m, lines: [...m.lines, emptyManualLine()] }))}
              >
                + Add item
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button type="submit" className="btn-primary" disabled={finance.loading || !finance.allowed || manualSaving}>
                {manualSaving ? <Spinner className="h-4 w-4" /> : 'Create manual purchase'}
              </button>
              {!finance.allowed && !finance.loading && <ZraFinanceNotice access={finance} />}
            </div>
          </form>
        )}

        <div className="mt-4">
          {loading && rows == null ? (
            <Loading label="Loading purchases…" />
          ) : !rows || rows.length === 0 ? (
            <EmptyState>{tab === 'pending' ? 'No pending purchases.' : 'No manual purchases.'}</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Invoice</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Purchase date</th>
                    <th className="px-3 py-2 font-medium">Fetched</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 last:border-0 ${selectedId === p.id ? 'bg-green-50/40' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.spplrNm || '—'}</div>
                        <div className="font-mono text-xs text-gray-400">{p.spplrTpin}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{p.spplrInvcNo || '—'}</td>
                      <td className="px-3 py-2">{money(p.totAmt)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        {p.lastError && (
                          <div className="mt-1 max-w-xs text-xs text-red-600">{p.lastError}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">{formatPurchaseDate(p.pchsDt)}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{formatDate(p.createdAt ?? undefined)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => openDetail(p.id)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              {total} total · page {page + 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                disabled={loading || (page + 1) * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>

      {selectedId != null && (
        <Card>
          <SectionTitle
            action={
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
              >
                Close
              </button>
            }
          >
            Purchase #{selectedId}
          </SectionTitle>

          {detailLoading || !detail ? (
            <Loading label="Loading detail…" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="text-sm">
                  <div className="label">Supplier</div>
                  <div className="font-medium">{detail.purchase.spplrNm}</div>
                  <div className="font-mono text-xs text-gray-500">{detail.purchase.spplrTpin}</div>
                </div>
                <div className="text-sm">
                  <div className="label">Purchase date</div>
                  <div className="font-medium">{formatPurchaseDate(detail.purchase.pchsDt)}</div>
                  <div className="text-xs text-gray-400">
                    Fetched {formatDate(detail.purchase.createdAt ?? undefined)}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="label">Status</div>
                  <Badge tone={statusTone(detail.purchase.status)}>{detail.purchase.status}</Badge>
                </div>
                <div className="text-sm">
                  <div className="label">Total</div>
                  <div className="font-medium">{money(detail.purchase.totAmt)}</div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Partial accept is one approved purchase: set accept qty below retrieved to take fewer
                units, or 0 / Skip to reject that line. Use Reject only when the whole document is refused.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium text-right">Retrieved</th>
                      <th className="px-3 py-2 font-medium text-right">Accept qty</th>
                      <th className="px-3 py-2 font-medium text-right">Unit price</th>
                      <th className="px-3 py-2 font-medium text-right">Line total</th>
                      <th className="px-3 py-2 font-medium">Mapped SKU</th>
                      <th className="px-3 py-2 font-medium">Map</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => {
                      const acceptQty = Number((lineQtyDraft[line.id] ?? '').trim() || line.retrievedQty || 0);
                      const rejectedLine = Number.isFinite(acceptQty) && acceptQty <= 0;
                      const canEdit =
                        detail.purchase.status === 'PENDING_APPROVAL' ||
                        detail.purchase.status === 'FAILED';
                      return (
                      <tr key={line.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 text-xs">{line.itemSeq}</td>
                        <td className="px-3 py-2">
                          <div>{line.itemNm || line.spplrItemNm}</div>
                          <div className="font-mono text-xs text-gray-400">{line.spplrItemCd}</div>
                          {rejectedLine && canEdit && (
                            <div className="mt-0.5 text-xs text-red-600">Rejected (qty 0)</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{line.retrievedQty ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                className="input w-20 py-1 text-right tabular-nums"
                                inputMode="decimal"
                                value={lineQtyDraft[line.id] ?? ''}
                                onChange={(e) =>
                                  setLineQtyDraft((d) => ({ ...d, [line.id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="btn-ghost px-1.5 py-1 text-xs text-red-600"
                                title="Reject this line (qty 0)"
                                onClick={() => setLineQtyDraft((d) => ({ ...d, [line.id]: '0' }))}
                              >
                                Skip
                              </button>
                            </div>
                          ) : (
                            <span className="tabular-nums">{line.approvedQty ?? line.retrievedQty ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(line.prc)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{money(line.totAmt)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{line.itemCd || '—'}</td>
                        <td className="px-3 py-2">
                          {canEdit && !rejectedLine && (
                            <div className="w-56 space-y-1">
                              <div className="flex items-center gap-1">
                                <div className="w-40">
                                  <SkuPicker
                                    value={lineSkuDraft[line.id] ?? ''}
                                    onChange={(sku) => {
                                      setLineSkuDraft((d) => ({ ...d, [line.id]: sku }));
                                      setLineRegStatus((s) => {
                                        const next = { ...s };
                                        delete next[line.id];
                                        return next;
                                      });
                                    }}
                                    placeholder="Search SKU…"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn-ghost px-2 py-1 text-xs"
                                  disabled={
                                    finance.loading || !finance.allowed || busyAction === `map-${line.id}`
                                  }
                                  title={!finance.allowed ? 'Finance admin only' : undefined}
                                  onClick={() => handleMapLine(line.id)}
                                >
                                  {busyAction === `map-${line.id}` ? (
                                    <Spinner className="h-3.5 w-3.5" />
                                  ) : (
                                    'Map'
                                  )}
                                </button>
                              </div>
                              {(lineSkuDraft[line.id] ?? '').trim() && (
                                <div className="flex items-center gap-1">
                                  {lineRegStatus[line.id] ? (
                                    lineRegStatus[line.id] === 'loading' ? (
                                      <Spinner className="h-3 w-3" />
                                    ) : lineRegStatus[line.id] === 'error' ? (
                                      <Badge tone="gray">Unknown</Badge>
                                    ) : (
                                      <Badge
                                        tone={
                                          (lineRegStatus[line.id] as ZraItemRegistrationStatus).registered
                                            ? 'green'
                                            : 'amber'
                                        }
                                      >
                                        {(lineRegStatus[line.id] as ZraItemRegistrationStatus).registered
                                          ? 'Registered'
                                          : 'Not registered'}
                                      </Badge>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      className="text-xs text-gray-400 underline hover:text-gray-600"
                                      onClick={() =>
                                        checkLineRegistration(line.id, (lineSkuDraft[line.id] ?? '').trim())
                                      }
                                    >
                                      Check ZRA registration
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(detail.purchase.status === 'PENDING_APPROVAL' || detail.purchase.status === 'FAILED') && (
                <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Store">
                    <p className="input cursor-default bg-gray-50 text-gray-700">
                      #{detail.purchase.storeId ?? storeId ?? '—'}
                    </p>
                  </Field>
                  <Field label="Paper receipt ref">
                    <input
                      className="input"
                      value={paperReceiptRef}
                      onChange={(e) => setPaperReceiptRef(e.target.value)}
                    />
                  </Field>
                  <Field label="Reject reason">
                    <input
                      className="input"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-col justify-end gap-1">
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        className="btn-primary flex-1"
                        disabled={finance.loading || !finance.allowed || busyAction != null}
                        onClick={handleApprove}
                      >
                        {busyAction === 'approve' ? <Spinner className="h-4 w-4" /> : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost flex-1 text-red-600 hover:bg-red-50"
                        disabled={finance.loading || !finance.allowed || busyAction != null}
                        onClick={handleReject}
                      >
                        {busyAction === 'reject' ? <Spinner className="h-4 w-4" /> : 'Reject'}
                      </button>
                    </div>
                    {!finance.allowed && !finance.loading && <ZraFinanceNotice access={finance} />}
                  </div>
                </div>
              )}

              {detail.purchase.lastError && (
                <ErrorBox message={detail.purchase.lastError} />
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
