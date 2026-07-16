'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import {
  STORE_STOCK_STATUS_OPTIONS,
  type StoreStockBrowseItem,
  type StoreStockBrowsePageResponse
} from '@/lib/inventoryHealthTypes';
import { downloadStoreStockCsv } from '@/lib/exportStoreStockCsv';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

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

  const load = useCallback(async (sid: number | null, pg: number) => {
    if (sid == null) return;
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
      setData(result);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load store inventory.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, appliedStatus]);

  function handleStoreChange(id: number | null) {
    setStoreId(id);
    setQuery('');
    setStatus('');
    setAppliedQuery('');
    setAppliedStatus('');
    setPage(0);
  }

  useEffect(() => {
    load(storeId, page);
  }, [storeId, page, load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedQuery(query);
    setAppliedStatus(status);
    setPage(0);
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
            All catalog products at a store — one row per bin, or zero stock when not inwarded.
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
              <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
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
            Showing {data.content.length} of {data.totalElements} rows
            {data.totalPages > 1 ? ` · page ${data.page + 1} of ${data.totalPages}` : ''}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Barcode</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Current</th>
                <th className="px-5 py-3 font-medium">Reserved</th>
                <th className="px-5 py-3 font-medium">Available</th>
                <th className="px-5 py-3 font-medium">Safety</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((row) => (
                <tr
                  key={`${row.sku}-${row.inventoryItemId ?? 'zero'}-${row.locationCode ?? 'none'}`}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{row.sku}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{row.productName}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{row.barcode ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">{row.locationCode ?? '—'}</td>
                  <td className="px-5 py-3">{row.currentStock}</td>
                  <td className="px-5 py-3 text-gray-500">{row.reservedStock}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.availabilityStatus)}>{row.availableStock}</Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{row.safetyStock ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.availabilityStatus)}>{statusLabel(row.availabilityStatus)}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href="/inventory" className="text-sm font-medium text-brand-green-dark hover:underline">
                      Inward
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={data.first || loading}
                onClick={() => {
                  const next = page - 1;
                  setPage(next);
                  load(storeId, next);
                }}
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
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  load(storeId, next);
                }}
              >
                Next
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
