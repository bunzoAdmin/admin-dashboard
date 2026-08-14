'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ClipboardList,
  Package,
  RefreshCw,
  ShoppingBag,
  Timer
} from 'lucide-react';
import clsx from 'clsx';
import { api, ApiClientError } from '@/lib/api';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import { refundAdminApi } from '@/lib/refundAdminApi';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import { resolveLocalMetricsRange, todayIsoLocal } from '@/lib/pickerMetricsRange';
import { formatAgeMinutes } from '@/lib/storeTime';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Card, EmptyState, ErrorBox, Loading, Stat } from '@/components/ui';

const QUICK_LINKS = [
  { href: '/orders/pipeline', label: 'Order pipeline', icon: ClipboardList },
  { href: '/orders/list', label: 'All orders', icon: ShoppingBag },
  { href: '/orders/metrics', label: 'Order metrics', icon: BarChart3 },
  { href: '/inventory/alerts', label: 'Inventory alerts', icon: AlertTriangle },
  { href: '/inventory/expiry', label: 'Expiry report', icon: Timer },
  { href: '/orders/disputes', label: 'Disputes', icon: Bell }
];

type TileTone = 'alert' | 'warn' | undefined;

interface Tile {
  href: string;
  label: string;
  value: number | string;
  sub?: string;
  tone?: TileTone;
}

const CONFIRMED_STUCK_MINUTES = 30;

export default function HomePage() {
  const { storeId, setStoreId } = useStoreContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [deliveredToday, setDeliveredToday] = useState<number | null>(null);
  const [inFlightOrders, setInFlightOrders] = useState<number | null>(null);
  const [confirmedStuck, setConfirmedStuck] = useState<{ count: number; oldestAgeMinutes: number | null } | null>(
    null
  );
  const [stuckRefunds, setStuckRefunds] = useState<number | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);
  const [outOfStock, setOutOfStock] = useState<number | null>(null);
  const [expired, setExpired] = useState<number | null>(null);
  const [openDisputes, setOpenDisputes] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const darkstoresRes = await api.listDarkstores().catch(() => ({ darkstores: [] }));
      const canonicalStoreId =
        darkstoresRes.darkstores.find((s) => parseInt(s.darkstore_id, 10) === storeId)?.darkstore_id ??
        String(storeId);

      const range = resolveLocalMetricsRange({
        period: 'DAY',
        anchorDate: todayIsoLocal(),
        customFrom: todayIsoLocal(),
        customTo: todayIsoLocal()
      });

      const [pipeline, analytics, refunds, lowStockList, outOfStockPage, expiryReport, disputeSummary] =
        await Promise.all([
          orderAdminApi.getPipeline(storeId),
          orderAdminApi.getAnalytics(storeId, {
            period: range.period,
            from: range.from,
            toExclusive: range.toExclusive,
            label: range.label,
            calendarFrom: range.calendarFrom,
            calendarTo: range.calendarTo,
            utcOffsetMinutes: range.utcOffsetMinutes,
            slaMinutes: 15
          }),
          refundAdminApi.listStuck().catch(() => []),
          inventoryHealthApi.getLowStock(storeId).catch(() => []),
          inventoryHealthApi
            .browseStoreStock({ storeId, status: 'OUT_OF_STOCK', size: 1 })
            .catch(() => ({ totalElements: 0 })),
          inventoryHealthApi
            .getExpiryReport({ storeId, bucket: 'EXPIRED', size: 1 })
            .catch(() => ({ summary: { expiredCount: 0 } })),
          api.getDisputeSummary(canonicalStoreId).catch(() => null)
        ]);

      const confirmedStage = pipeline.stages.find((s) => s.status === 'CONFIRMED');

      setDeliveredToday(analytics.overview.deliveredOrders);
      setInFlightOrders(pipeline.stages.reduce((sum, s) => sum + s.count, 0));
      setConfirmedStuck({
        count: confirmedStage?.count ?? 0,
        oldestAgeMinutes: confirmedStage?.oldestAgeMinutes ?? null
      });
      setStuckRefunds(refunds.length);
      setLowStock(lowStockList.length);
      setOutOfStock(outOfStockPage.totalElements);
      setExpired(expiryReport.summary.expiredCount);
      setOpenDisputes(disputeSummary?.open ?? 0);
      setLoaded(true);
    } catch (err) {
      const msg =
        err instanceof OrderAdminApiError ||
        err instanceof InventoryHealthApiError ||
        err instanceof ApiClientError
          ? err.message
          : 'Failed to load dashboard.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const orderTiles = useMemo((): Tile[] => {
    const confirmedTone: TileTone =
      confirmedStuck != null &&
      confirmedStuck.count > 0 &&
      confirmedStuck.oldestAgeMinutes != null &&
      confirmedStuck.oldestAgeMinutes >= CONFIRMED_STUCK_MINUTES
        ? 'alert'
        : confirmedStuck != null && confirmedStuck.count > 0
          ? 'warn'
          : undefined;

    return [
      {
        href: '/orders/metrics',
        label: 'Delivered today',
        value: deliveredToday ?? '—',
        sub: 'Store calendar day (CAT)'
      },
      {
        href: '/orders/pipeline',
        label: 'In-flight orders',
        value: inFlightOrders ?? '—',
        sub: 'Pending payment through out for delivery'
      },
      {
        href: '/orders/list?status=CONFIRMED',
        label: 'Stuck in confirmed',
        value: confirmedStuck?.count ?? '—',
        sub:
          confirmedStuck != null && confirmedStuck.count > 0 && confirmedStuck.oldestAgeMinutes != null
            ? `Oldest ${formatAgeMinutes(confirmedStuck.oldestAgeMinutes)}`
            : confirmedStuck?.count === 0
              ? 'None waiting'
              : undefined,
        tone: confirmedTone
      }
    ];
  }, [deliveredToday, inFlightOrders, confirmedStuck]);

  const inventoryTiles = useMemo(
    (): Tile[] => [
      {
        href: '/inventory/alerts',
        label: 'Low stock SKUs',
        value: lowStock ?? '—',
        tone: lowStock != null && lowStock > 0 ? 'warn' : undefined
      },
      {
        href: '/inventory/browse',
        label: 'Out of stock SKUs',
        value: outOfStock ?? '—',
        tone: outOfStock != null && outOfStock > 0 ? 'alert' : undefined
      },
      {
        href: '/inventory/expiry',
        label: 'Expired bins',
        value: expired ?? '—',
        tone: expired != null && expired > 0 ? 'alert' : undefined
      }
    ],
    [lowStock, outOfStock, expired]
  );

  const attentionTiles = useMemo((): Tile[] => {
    const tiles: Tile[] = [
      {
        href: '/finance/refunds',
        label: 'Stuck refunds',
        value: stuckRefunds ?? '—',
        tone: stuckRefunds != null && stuckRefunds > 0 ? 'alert' : undefined
      },
      {
        href: '/orders/disputes',
        label: 'Open disputes',
        value: openDisputes ?? '—',
        tone: openDisputes != null && openDisputes > 0 ? 'alert' : undefined
      }
    ];
    return tiles.filter((t) => typeof t.value === 'number' && t.value > 0);
  }, [stuckRefunds, openDisputes]);

  function renderTileGrid(tiles: Tile[]) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Orders &amp; inventory at a glance — refreshes every 30s.</p>
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
        <EmptyState>Select a store to view the dashboard.</EmptyState>
      ) : loading && !loaded ? (
        <Loading label="Loading dashboard…" />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Orders</h2>
            {renderTileGrid(orderTiles)}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Inventory</h2>
            {renderTileGrid(inventoryTiles)}
          </section>

          {attentionTiles.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Needs attention</h2>
              {renderTileGrid(attentionTiles)}
            </section>
          ) : null}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Quick links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            href="/finance/refunds"
            className="card flex items-center gap-3 p-4 transition hover:border-brand-green/30 hover:shadow-card"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green-light text-brand-green-dark">
              <Package className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-gray-900">Stuck refunds</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
