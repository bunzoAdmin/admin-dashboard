'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import type { ExpiryBucket, ExpiryStockReportResponse, ExpiryStockRow } from '@/lib/expiryStockTypes';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, Stat } from '@/components/ui';

const WITHIN_DAY_OPTIONS = [1, 3, 7, 14, 30];

const BUCKETS: { id: ExpiryBucket; label: string }[] = [
  { id: 'ATTENTION', label: 'Needs attention' },
  { id: 'EXPIRED', label: 'Expired' },
  { id: 'EXPIRING', label: 'Expiring soon' },
  { id: 'NO_EXPIRY', label: 'No expiry date' },
  { id: 'OK', label: 'OK (beyond window)' },
  { id: 'ALL', label: 'All stocked bins' }
];

function bucketTone(bucket: string): 'red' | 'amber' | 'gray' | 'green' {
  switch (bucket) {
    case 'EXPIRED':
      return 'red';
    case 'EXPIRING':
      return 'amber';
    case 'OK':
      return 'green';
    default:
      return 'gray';
  }
}

function daysLabel(row: ExpiryStockRow): string {
  if (row.daysUntilExpiry == null) return '—';
  if (row.daysUntilExpiry < 0) return `${Math.abs(row.daysUntilExpiry)}d overdue`;
  if (row.daysUntilExpiry === 0) return 'Today';
  return `${row.daysUntilExpiry}d left`;
}

export default function ExpiryStockPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [withinDays, setWithinDays] = useState(3);
  const [bucket, setBucket] = useState<ExpiryBucket>('ATTENTION');
  const [data, setData] = useState<ExpiryStockReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      setData(await inventoryHealthApi.getExpiryReport({ storeId, withinDays, bucket }));
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load expiry report.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [storeId, withinDays, bucket]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDownload() {
    if (storeId == null) return;
    setDownloading(true);
    setError(null);
    try {
      await inventoryHealthApi.downloadExpiryCsv({ storeId, withinDays, bucket });
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'CSV download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expiry report</h1>
          <p className="text-sm text-gray-500">
            Stocked bins (shelf + storeroom) vs PDP use-by date (product-level, shared across bins).
            Report only — no write-off.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={handleDownload}
            disabled={storeId == null || downloading}
          >
            {downloading ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            Download CSV
          </button>
        </div>
      </div>

      <Card className="space-y-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />

        <div className="flex flex-wrap items-end gap-4">
          <label className="block space-y-1">
            <span className="label">Expiring within (days)</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input"
                value={WITHIN_DAY_OPTIONS.includes(withinDays) ? String(withinDays) : 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'custom') return;
                  setWithinDays(Number(e.target.value));
                }}
              >
                {WITHIN_DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} day{d === 1 ? '' : 's'}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <input
                type="number"
                min={0}
                max={365}
                className="input w-24"
                value={withinDays}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setWithinDays(Math.min(365, Math.max(0, Math.floor(n))));
                }}
                aria-label="Custom expiry window days"
              />
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={clsx(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition',
                  bucket === b.id
                    ? 'bg-brand-green text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                onClick={() => setBucket(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view expiry stock.</EmptyState>
      ) : loading && !data ? (
        <Loading label="Loading expiry report…" />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Expired"
              value={data.summary.expiredCount}
              sub={`${data.summary.expiredUnits} units`}
            />
            <Stat
              label={`Expiring ≤${data.withinDays}d`}
              value={data.summary.expiringCount}
              sub={`${data.summary.expiringUnits} units`}
            />
            <Stat
              label="No expiry date"
              value={data.summary.noExpiryCount}
              sub={`${data.summary.noExpiryUnits} units`}
            />
            <Stat
              label="Stocked bins"
              value={data.summary.totalRows}
              sub={`As of ${data.asOfDate} (CAT)`}
            />
          </div>

          <Card className="overflow-hidden p-0 relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                <Spinner className="h-6 w-6" />
              </div>
            )}
            {data.items.length === 0 ? (
              <EmptyState>No bins match this filter.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium text-right">Qty</th>
                      <th className="px-4 py-3 font-medium">Use-by</th>
                      <th className="px-4 py-3 font-medium">Days</th>
                      <th className="px-4 py-3 font-medium">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.inventoryItemId} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{row.sku}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.productName}</div>
                          {row.barcode && (
                            <div className="font-mono text-[11px] text-gray-400">{row.barcode}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{row.locationCode ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.currentStock}
                          {row.reservedStock > 0 && (
                            <span className="ml-1 text-xs text-gray-400">({row.reservedStock} res)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-gray-600">
                          {row.useByDate ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">{daysLabel(row)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={bucketTone(row.bucket)}>
                            {row.bucket.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
