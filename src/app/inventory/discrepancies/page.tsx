'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import type { DiscrepancyDetailResponse } from '@/lib/inventoryHealthTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function DiscrepanciesPage() {
  const toast = useToast();
  const { storeId, setStoreId } = useStoreContext();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [rows, setRows] = useState<DiscrepancyDetailResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolvedByInput, setResolvedByInput] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const load = useCallback(async (sid: number, st: string) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await inventoryHealthApi.listDiscrepancies(sid, { status: st || undefined, size: 100 }));
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load discrepancies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(storeId, statusFilter); }, [storeId, statusFilter, load]);

  async function handleResolve(id: number) {
    const resolvedBy = resolvedByInput.trim() || 'ADMIN';
    setResolving(id);
    try {
      const updated = await inventoryHealthApi.resolveDiscrepancy(id, resolvedBy);
      setRows(prev => prev?.map(r => r.id === id ? updated : r) ?? null);
      toast.push('success', 'Discrepancy resolved.');
      setResolvingId(null);
      setResolvedByInput('');
    } catch (err) {
      toast.push('error', err instanceof InventoryHealthApiError ? err.message : 'Resolve failed.');
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stock Discrepancies</h1>
        <p className="text-sm text-gray-500">Inventory mismatches reported by pickers during picking operations.</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
        <label className="block space-y-1.5">
          <span className="label">Status</span>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </label>
      </div>

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && rows === null ? (
          <div className="p-6"><Loading label="Loading discrepancies…" /></div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No discrepancies for the selected filters.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Actual</th>
                  <th className="px-4 py-3 font-medium">Diff</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reported by</th>
                  <th className="px-4 py-3 font-medium">Resolved by</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r: DiscrepancyDetailResponse) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{r.sku}</td>
                      <td className="px-4 py-3">{r.expectedQuantity}</td>
                      <td className="px-4 py-3">{r.actualQuantity}</td>
                      <td className="px-4 py-3">
                        <Badge tone={r.discrepancyQuantity < 0 ? 'red' : 'amber'}>
                          {r.discrepancyQuantity > 0 ? '+' : ''}{r.discrepancyQuantity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={r.status === 'OPEN' ? 'amber' : 'green'}>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.reportedBy ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.resolvedBy ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'OPEN' && (
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => setResolvingId(resolvingId === r.id ? null : r.id)}
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                    {resolvingId === r.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input
                              className="input w-48"
                              placeholder="Resolved by (name / ID)"
                              value={resolvedByInput}
                              onChange={e => setResolvedByInput(e.target.value)}
                            />
                            <button
                              className="btn-primary text-sm"
                              disabled={resolving === r.id}
                              onClick={() => handleResolve(r.id)}
                            >
                              {resolving === r.id ? <Spinner className="h-4 w-4" /> : 'Confirm Resolve'}
                            </button>
                            <button className="btn-ghost text-sm" onClick={() => setResolvingId(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
