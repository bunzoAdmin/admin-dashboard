'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  PackagePlus,
  RefreshCw,
  RefreshCw as SyncIcon
} from 'lucide-react';
import clsx from 'clsx';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import { refundAdminApi } from '@/lib/refundAdminApi';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Card, EmptyState, ErrorBox, Loading, Stat } from '@/components/ui';

const QUICK_LINKS = [
  { href: '/pickers', label: 'Live ops', icon: ClipboardList },
  { href: '/pickers/attention', label: 'Needs attention', icon: Bell },
  { href: '/orders/pipeline', label: 'Order pipeline', icon: ClipboardList },
  { href: '/inventory/alerts', label: 'Inventory alerts', icon: PackagePlus }
];

export default function HomePage() {
  const { storeId, setStoreId } = useStoreContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attentionCount, setAttentionCount] = useState<number | null>(null);
  const [pendingTasks, setPendingTasks] = useState<number | null>(null);
  const [activeTasks, setActiveTasks] = useState<number | null>(null);
  const [completedToday, setCompletedToday] = useState<number | null>(null);
  const [inFlightOrders, setInFlightOrders] = useState<number | null>(null);
  const [stuckRefunds, setStuckRefunds] = useState<number | null>(null);
  const [abandonedSync, setAbandonedSync] = useState<number | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [metrics, attention, pipeline, refunds, reconcile, stock] = await Promise.all([
        pickerApi.getMetrics(storeId),
        pickerApi.listAttention(storeId, 5),
        orderAdminApi.getPipeline(storeId),
        refundAdminApi.listStuck().catch(() => []),
        pickerApi.listReconcileFailures(0, 100, storeId).catch(() => []),
        inventoryHealthApi.getLowStock(storeId).catch(() => [])
      ]);
      setAttentionCount(attention.total);
      setPendingTasks(metrics.pendingTasks);
      setActiveTasks(metrics.activeTasks);
      setCompletedToday(metrics.completedToday);
      setInFlightOrders(pipeline.stages.reduce((sum, s) => sum + s.count, 0));
      setStuckRefunds(refunds.length);
      setAbandonedSync(reconcile.filter((r) => r.status === 'ABANDONED').length);
      setLowStock(stock.length);
    } catch (err) {
      const msg =
        err instanceof PickerApiError || err instanceof OrderAdminApiError || err instanceof InventoryHealthApiError
          ? err.message
          : 'Failed to load ops summary.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const tiles = useMemo(
    () => [
      {
        href: '/pickers/attention',
        label: 'Needs attention',
        value: attentionCount ?? '—',
        tone: attentionCount != null && attentionCount > 0 ? 'alert' : undefined
      },
      {
        href: '/pickers',
        label: 'Pick queue',
        value: pendingTasks != null && activeTasks != null ? pendingTasks + activeTasks : '—',
        sub: pendingTasks != null ? `${pendingTasks} pending · ${activeTasks ?? 0} active` : undefined
      },
      {
        href: '/pickers',
        label: 'Completed today',
        value: completedToday ?? '—'
      },
      {
        href: '/orders/pipeline',
        label: 'In-flight orders',
        value: inFlightOrders ?? '—'
      },
      {
        href: '/finance/refunds',
        label: 'Stuck refunds',
        value: stuckRefunds ?? '—',
        tone: stuckRefunds != null && stuckRefunds > 0 ? 'alert' : undefined
      },
      {
        href: '/pickers/reconcile',
        label: 'Abandoned sync',
        value: abandonedSync ?? '—',
        tone: abandonedSync != null && abandonedSync > 0 ? 'alert' : undefined
      },
      {
        href: '/inventory/alerts',
        label: 'Low stock SKUs',
        value: lowStock ?? '—',
        tone: lowStock != null && lowStock > 0 ? 'warn' : undefined
      }
    ],
    [attentionCount, pendingTasks, activeTasks, completedToday, inFlightOrders, stuckRefunds, abandonedSync, lowStock]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ops home</h1>
          <p className="text-sm text-gray-500">Store health at a glance — refreshes every 30s.</p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <Card>
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view the ops rollup.</EmptyState>
      ) : loading && attentionCount === null ? (
        <Loading label="Loading ops summary…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href} className="block transition hover:opacity-90">
              <div
                className={clsx(
                  'card p-4',
                  tile.tone === 'alert' && 'border-red-200 bg-red-50/50',
                  tile.tone === 'warn' && 'border-amber-200 bg-amber-50/50'
                )}
              >
                <Stat label={tile.label} value={tile.value} sub={tile.sub} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Quick links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="card flex items-center gap-3 p-4 transition hover:border-brand-green/30 hover:shadow-card"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green-light text-brand-green-dark">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-gray-900">{label}</span>
            </Link>
          ))}
          <Link
            href="/pickers/reconcile"
            className="card flex items-center gap-3 p-4 transition hover:border-brand-green/30 hover:shadow-card"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green-light text-brand-green-dark">
              <SyncIcon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-gray-900">Sync failures</span>
          </Link>
          <Link
            href="/orders/disputes"
            className="card flex items-center gap-3 p-4 transition hover:border-brand-green/30 hover:shadow-card"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green-light text-brand-green-dark">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-gray-900">Disputes</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
