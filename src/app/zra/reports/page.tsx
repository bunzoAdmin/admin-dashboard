'use client';

import { useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  Spinner,
  formatDate,
  money,
  useToast
} from '@/components/ui';
import { addStoreCalendarDays, todayIsoStore } from '@/lib/storeTime';
import { zraApi, ZraApiError, type ZraVatRow } from '@/lib/zraApi';
import { useZraStore, ZraStoreSelector, ZRA_ALL_STORES_SCOPE } from '@/components/zra/ZraStoreSelector';

function toIsoStart(date: string): string {
  return new Date(`${date}T00:00:00+02:00`).toISOString();
}

function toIsoEndExclusive(date: string): string {
  const d = new Date(`${date}T00:00:00+02:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export default function ZraReportsPage() {
  const toast = useToast();
  const today = todayIsoStore();
  const weekAgo = addStoreCalendarDays(today, -6);
  const { storeIdParam } = useZraStore();
  const [filterScope, setFilterScope] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo] = useState(today);
  const [rows, setRows] = useState<ZraVatRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [recomputed, setRecomputed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function range() {
    return {
      storeId: filterScope === ZRA_ALL_STORES_SCOPE ? undefined : storeIdParam,
      from: toIsoStart(dateFrom),
      to: toIsoEndExclusive(dateTo)
    };
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const report = await zraApi.getVatReport(range());
      setRows(report.content ?? []);
      setTruncated(Boolean(report.truncated));
      setRecomputed(report.recomputedSalesCount ?? 0);
      toast.push('success', `${report.totalElements} VAT row(s) loaded.`);
    } catch (err) {
      setRows(null);
      setError(err instanceof ZraApiError ? err.message : 'Failed to load VAT report.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCsv() {
    setExporting(true);
    try {
      await zraApi.downloadVatCsv(range());
      toast.push('success', 'VAT CSV downloaded.');
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ZRA VAT report</h1>
        <p className="text-sm text-gray-500">
          Issued tax invoices and credit notes for a date range — preview or download Excel-compatible CSV.
        </p>
      </div>

      <form onSubmit={handlePreview}>
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ZraStoreSelector
              allowAll
              scope={filterScope}
              onScopeChange={setFilterScope}
            />
            <Field label="From (CAT date)">
              <input
                className="input"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </Field>
            <Field label="To (CAT date, inclusive)">
              <input
                className="input"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4" /> : 'Preview'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={exporting}
                onClick={() => void handleCsv()}
              >
                {exporting ? <Spinner className="h-4 w-4" /> : 'Download CSV'}
              </button>
            </div>
          </div>
        </Card>
      </form>

      {error && <ErrorBox message={error} />}
      {truncated && (
        <ErrorBox message="Result truncated at 10,000 rows per document type — narrow the date range." />
      )}
      {recomputed > 0 && (
        <p className="text-xs text-amber-700">
          {recomputed} sale row(s) recomputed from current SKU mappings (invoices issued before tax totals
          were stored). New invoices use persisted amounts.
        </p>
      )}
      {loading ? (
        <Loading label="Building VAT register…" />
      ) : rows == null ? null : rows.length === 0 ? (
        <EmptyState>No ISSUED sales or credit notes in this range.</EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Issued</th>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Invc</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium text-right">Taxable</th>
                  <th className="px-3 py-2 font-medium text-right">VAT</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.docType}-${r.id}`} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-xs font-mono">{r.docType}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {r.issuedAt ? formatDate(r.issuedAt) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.orderNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.invcNo ?? '—'}</td>
                    <td className="px-3 py-2 text-xs max-w-[10rem] truncate">{r.customerName || '—'}</td>
                    <td className="px-3 py-2 text-xs text-right">{money(r.taxableAmount ?? 0)}</td>
                    <td className="px-3 py-2 text-xs text-right">{money(r.vatAmount ?? 0)}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium">{money(r.totalInclusive ?? 0)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.taxSource ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            {rows.length} row(s)
          </div>
        </Card>
      )}
    </div>
  );
}
