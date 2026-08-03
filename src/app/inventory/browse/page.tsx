'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import {
  STORE_STOCK_STATUS_OPTIONS,
  type StoreStockBrowseBin,
  type StoreStockBrowseItem,
  type StoreStockBrowsePageResponse
} from '@/lib/inventoryHealthTypes';
import { downloadStoreStockCsv } from '@/lib/exportStoreStockCsv';
import { RelocateStockModal, type RelocateBinTarget } from '@/components/inventory/RelocateStockModal';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

function canRelocate(bin: StoreStockBrowseBin): boolean {
  return Boolean(bin.inventoryItemId && bin.locationCode?.trim() && bin.availableStock > 0);
}

function statusTone(status: string): 'green' | 'amber' | 'red' | 'gray' {
  switch (status) {
    case 'AVAILABLE':
      return 'green';
    case 'LOW_STOCK':
      return 'amber';
    case 'OUT_OF_STOCK':
      return 'red';
    default:
      return 'gray';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'AVAILABLE':
      return 'In stock';
    case 'LOW_STOCK':
      return 'Low stock';
    case 'OUT_OF_STOCK':
      return 'Out of stock';
    default:
      return status;
  }
}

function locationsPreview(row: StoreStockBrowseItem): string {
  if (!row.bins?.length) return 'Not inwarded';
  const parts = row.bins
    .filter((b) => b.availableStock > 0)
    .map((b) => `${b.locationCode ?? '—'} (${b.availableStock})`);
  if (parts.length === 0) {
    return row.bins.map((b) => b.locationCode ?? '—').join(', ');
  }
  if (parts.length <= 3) return parts.join(', ');
  return `${parts.slice(0, 3).join(', ')} +${parts.length - 3}`;
}

async function fetchAllFilteredRows(
  storeId: number,
  q: string,
  status: string
): Promise<StoreStockBrowseItem[]> {
  const all: StoreStockBrowseItem[] = [];
  let page = 0;
  while (true) {
    const res = await inventoryHealthApi.browseStoreStock({
      storeId,
      q: q.trim() || undefined,
      status: status || undefined,
      page,
      size: 200
    });
    all.push(...res.content);
    if (res.last) break;
    page += 1;
  }
  return all;
}

export default function InventoryBrowsePage() {
  const { storeId, setStoreId } = useStoreContext();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<StoreStockBrowsePageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(() => new Set());
  const [relocateTarget, setRelocateTarget] = useState<RelocateBinTarget | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async (sid: number | null, pg: number) => {
    if (sid == null) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryHealthApi.browseStoreStock({
        storeId: sid,
        q: appliedQuery.trim() || undefined,
        status: appliedStatus || undefined,
        page: pg,
        size: 50
      });
      if (seq !== loadSeq.current) return;
      setData(result);
      setPage(result.page);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load store inventory.');
      setData(null);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [appliedQuery, appliedStatus]);

  function handleStoreChange(id: number | null) {
    setStoreId(id);
    setQuery('');
    setStatus('');
    setAppliedQuery('');
    setAppliedStatus('');
    setPage(0);
    setExpandedSkus(new Set());
  }

  useEffect(() => {
    void load(storeId, page);
  }, [storeId, page, load]);

  function onStatusChange(next: string) {
    setStatus(next);
    setAppliedStatus(next);
    setPage(0);
    setExpandedSkus(new Set());
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedQuery(query);
    setAppliedStatus(status);
    setPage(0);
    setExpandedSkus(new Set());
  }

  function toggleExpanded(sku: string) {
    setExpandedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  async function onExportCsv() {
    if (storeId == null) return;
    setExporting(true);
    setError(null);
    try {
      const rows = await fetchAllFilteredRows(storeId, appliedQuery, appliedStatus);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadStoreStockCsv(rows, `store-${storeId}-inventory-${stamp}.csv`);
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Browse inventory</h1>
          <p className="text-sm text-gray-500">
            One row per product at a store — totals across bins. Expand a row for bin detail and
            relocate. Status filters use store totals.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost text-sm inline-flex items-center gap-1.5"
          disabled={exporting || storeId == null}
          onClick={() => void onExportCsv()}
        >
          {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          Download CSV
        </button>
      </div>

      <form onSubmit={onSearch}>
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StoreSelector storeId={storeId} onStoreChange={handleStoreChange} />
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Status
              </label>
              <select
                className="input w-full"
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
              >
                {STORE_STOCK_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, product name, barcode…"
            />
            <button type="submit" className="btn-primary shrink-0">
              Search
            </button>
          </div>
        </Card>
      </form>

      {error && <ErrorBox message={error} />}
      {loading && <Loading label="Loading inventory…" />}

      {!loading && data && data.content.length === 0 && <EmptyState>No inventory rows match your filters.</EmptyState>}

      {!loading && data && data.content.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-gray-100 px-5 py-2 text-xs text-gray-500">
            Showing {data.content.length} of {data.totalElements} products
            {data.totalPages > 1 ? ` · page ${data.page + 1} of ${data.totalPages}` : ''}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="w-8 px-3 py-3 font-medium" />
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Barcode</th>
                <th className="px-5 py-3 font-medium">Locations</th>
                <th className="px-5 py-3 font-medium">Current</th>
                <th className="px-5 py-3 font-medium">Reserved</th>
                <th className="px-5 py-3 font-medium">Available</th>
                <th className="px-5 py-3 font-medium">Safety</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((row) => {
                const expanded = expandedSkus.has(row.sku);
                const hasBins = (row.bins?.length ?? 0) > 0;
                return (
                  <Fragment key={row.sku}>
                    <tr className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-3">
                        {hasBins ? (
                          <button
                            type="button"
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            aria-label={expanded ? 'Collapse bins' : 'Expand bins'}
                            aria-expanded={expanded}
                            onClick={() => toggleExpanded(row.sku)}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{row.sku}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.productName}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{row.barcode ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-gray-600">
                        <span title={locationsPreview(row)}>
                          {row.binCount > 0 ? (
                            <>
                              <span className="font-medium text-gray-800">{row.binCount}</span>
                              {' bin'}
                              {row.binCount === 1 ? '' : 's'}
                              <span className="ml-1 text-gray-400">· {locationsPreview(row)}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3">{row.currentStock}</td>
                      <td className="px-5 py-3 text-gray-500">{row.reservedStock}</td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(row.availabilityStatus)}>{row.availableStock}</Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{row.safetyStock ?? '—'}</td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(row.availabilityStatus)}>
                          {statusLabel(row.availabilityStatus)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href="/inventory" className="text-sm font-medium text-gray-500 hover:underline">
                          Inward
                        </Link>
                      </td>
                    </tr>
                    {expanded &&
                      (row.bins ?? []).map((bin) => (
                        <tr
                          key={`${row.sku}-${bin.inventoryItemId}`}
                          className="border-b border-gray-50 bg-gray-50/70 last:border-0"
                        >
                          <td className="px-3 py-2" />
                          <td className="px-5 py-2 font-mono text-xs text-gray-400" colSpan={2}>
                            <span className="ml-4 text-gray-500">↳ bin</span>
                          </td>
                          <td className="px-5 py-2 font-mono text-xs text-gray-500">—</td>
                          <td className="px-5 py-2 font-mono text-xs font-medium text-gray-800">
                            {bin.locationCode ?? '—'}
                          </td>
                          <td className="px-5 py-2 text-gray-600">{bin.currentStock}</td>
                          <td className="px-5 py-2 text-gray-400">{bin.reservedStock}</td>
                          <td className="px-5 py-2">
                            <Badge tone={statusTone(bin.availabilityStatus)}>{bin.availableStock}</Badge>
                          </td>
                          <td className="px-5 py-2 text-gray-400">{bin.safetyStock ?? '—'}</td>
                          <td className="px-5 py-2">
                            <Badge tone={statusTone(bin.availabilityStatus)}>
                              {statusLabel(bin.availabilityStatus)}
                            </Badge>
                          </td>
                          <td className="px-5 py-2 text-right">
                            {canRelocate(bin) ? (
                              <button
                                type="button"
                                className="text-sm font-medium text-brand-green-dark hover:underline"
                                onClick={() =>
                                  setRelocateTarget({
                                    sku: row.sku,
                                    productName: row.productName,
                                    bin
                                  })
                                }
                              >
                                Relocate
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={data.first || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {data.page + 1} of {data.totalPages}
              </span>
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={data.last || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </Card>
      )}

      {storeId != null && (
        <RelocateStockModal
          open={relocateTarget != null}
          storeId={storeId}
          target={relocateTarget}
          onClose={() => setRelocateTarget(null)}
          onDone={() => void load(storeId, page)}
        />
      )}
    </div>
  );
}
