'use client';

import { useCallback, useEffect, useState } from 'react';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import { MOVEMENT_TYPE_OPTIONS, type StockMovementResponse, type StockMovementsPageResponse } from '@/lib/inventoryHealthTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function movementTone(type: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (type) {
    case 'INBOUND': return 'green';
    case 'OUTBOUND': return 'red';
    case 'RESERVE': return 'amber';
    case 'UNRESERVE': return 'blue';
    case 'ADJUSTMENT': return 'gray';
    default: return 'gray';
  }
}

export default function StockMovementsPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [sku, setSku] = useState('');
  const [movementType, setMovementType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<StockMovementsPageResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sid: number | null, pg: number) => {
    if (sid == null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryHealthApi.listMovements({
        storeId: sid,
        sku: sku.trim() || undefined,
        movementType: movementType || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
        page: pg,
        size: 50
      });
      setData(result);
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load movements.');
    } finally {
      setLoading(false);
    }
  }, [sku, movementType, dateFrom, dateTo]);

  useEffect(() => {
    setPage(0);
    load(storeId, 0);
  }, [storeId, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load(storeId, 0);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stock Movements</h1>
        <p className="text-sm text-gray-500">Full audit trail of all inventory changes.</p>
      </div>

      <form onSubmit={handleSearch}>
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
            <label className="block space-y-1.5">
              <span className="label">SKU</span>
              <input className="input" placeholder="e.g. BNZ-00123" value={sku} onChange={e => setSku(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Movement Type</span>
              <select className="input" value={movementType} onChange={e => setMovementType(e.target.value)}>
                {MOVEMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">From</span>
              <input type="datetime-local" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">To</span>
              <input type="datetime-local" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4 mx-auto" /> : 'Search'}
              </button>
            </div>
          </div>
        </Card>
      </form>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store above to view stock movements.</EmptyState>
      ) : data && (
        <Card className="overflow-hidden p-0">
          {loading && data === null ? (
            <div className="p-6"><Loading label="Loading movements…" /></div>
          ) : data.content.length === 0 ? (
            <EmptyState>No movements found for the selected filters.</EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Ref ID</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">By</th>
                      <th className="px-4 py-3 font-medium">At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((m: StockMovementResponse) => (
                      <tr key={m.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">{m.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{m.sku ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge tone={movementTone(m.movementType)}>
                            {m.movementType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <span className={m.movementType === 'OUTBOUND' || m.movementType === 'RESERVE' ? 'text-red-600' : 'text-green-600'}>
                            {m.movementType === 'OUTBOUND' || m.movementType === 'RESERVE' ? '-' : '+'}{m.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{m.referenceType?.replace(/_/g, ' ')}</td>
                        <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-gray-400" title={m.referenceId ?? undefined}>{m.referenceId ?? '—'}</td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-xs text-gray-500">{m.reason ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{m.createdBy ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <span className="text-xs text-gray-500">
                    Page {data.page + 1} of {data.totalPages} &middot; {data.totalElements} records
                  </span>
                  <div className="flex gap-2">
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={data.first || loading} onClick={() => { setPage(p => p - 1); load(storeId, page - 1); }}>Prev</button>
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={data.last || loading} onClick={() => { setPage(p => p + 1); load(storeId, page + 1); }}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
