'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import type { InventoryItemResponse } from '@/lib/inventoryHealthTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function InventoryAlertsPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [lowStock, setLowStock] = useState<InventoryItemResponse[] | null>(null);
  const [replenishment, setReplenishment] = useState<InventoryItemResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sid: number | null) => {
    if (sid == null) return;
    setLoading(true);
    setError(null);
    try {
      const [ls, rep] = await Promise.all([
        inventoryHealthApi.getLowStock(sid),
        inventoryHealthApi.getReplenishment(sid)
      ]);
      setLowStock(ls);
      setReplenishment(rep);
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load inventory alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(storeId); }, [storeId, load]);

  function ItemTable({ items, emptyMsg }: { items: InventoryItemResponse[]; emptyMsg: string }) {
    if (items.length === 0) return <EmptyState>{emptyMsg}</EmptyState>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Current</th>
              <th className="px-4 py-3 font-medium">Reserved</th>
              <th className="px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3 font-medium">Safety stock</th>
              <th className="px-4 py-3 font-medium">Max stock</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-mono text-xs font-medium">{item.sku}</td>
                <td className="px-4 py-3">{item.currentStock}</td>
                <td className="px-4 py-3 text-gray-500">{item.reservedStock}</td>
                <td className="px-4 py-3">
                  <Badge tone={item.availableStock <= 0 ? 'red' : item.lowStock ? 'amber' : 'green'}>
                    {item.availableStock}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">{item.safetyStock}</td>
                <td className="px-4 py-3 text-gray-500">{item.maxStock ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{item.locationCode ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link href="/inventory" className="btn-ghost px-2 py-1 text-xs">Inward</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory Alerts</h1>
          <p className="text-sm text-gray-500">Low stock items and replenishment recommendations.</p>
        </div>
        <button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => load(storeId)} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <StoreSelector storeId={storeId} onStoreChange={setStoreId} />

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store above to view inventory alerts.</EmptyState>
      ) : loading ? (
        <Loading label="Loading alerts…" />
      ) : (
        <>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="text-base font-semibold text-gray-900">
                Low Stock {lowStock ? `(${lowStock.length})` : ''}
              </h2>
            </div>
            <Card className="overflow-hidden p-0">
              {lowStock ? <ItemTable items={lowStock} emptyMsg="No low stock items. All good." /> : <Loading />}
            </Card>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">
                Needs Replenishment {replenishment ? `(${replenishment.length})` : ''}
              </h2>
            </div>
            <Card className="overflow-hidden p-0">
              {replenishment ? <ItemTable items={replenishment} emptyMsg="No items need replenishment." /> : <Loading />}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
