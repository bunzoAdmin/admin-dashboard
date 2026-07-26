'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { OrderPipelineResponse } from '@/lib/orderAdminTypes';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Card, EmptyState, ErrorBox, Loading, Stat } from '@/components/ui';
import {
  ageToneClass,
  ageUrgencyTone,
  formatAgeMinutes,
  formatStoreDateTimeShort
} from '@/lib/storeTime';

const STAGE_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pending payment',
  CONFIRMED: 'Confirmed',
  PACKING: 'Packing',
  READY_FOR_DELIVERY: 'Ready for delivery',
  OUT_FOR_DELIVERY: 'Out for delivery'
};

export default function OrderPipelinePage() {
  const { storeId, setStoreId } = useStoreContext();
  const [data, setData] = useState<OrderPipelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoading(true);
    setError(null);
    try {
      setData(await orderAdminApi.getPipeline(storeId));
    } catch (err) {
      setError(err instanceof OrderAdminApiError ? err.message : 'Failed to load pipeline.');
      setData(null);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order pipeline</h1>
          <p className="text-sm text-gray-500">
            Oldest waiting time is the call signal — refreshes every 30s.
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Card>
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view the order pipeline.</EmptyState>
      ) : loading && !data ? (
        <Loading label="Loading pipeline…" />
      ) : data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {data.stages.map((stage) => {
            const tone = ageUrgencyTone(
              stage.count > 0 ? stage.oldestAgeMinutes : null
            );
            return (
              <Link
                key={stage.status}
                href={`/orders/list?status=${encodeURIComponent(stage.status)}`}
                className="block transition hover:opacity-90"
              >
                <Stat
                  label={STAGE_LABEL[stage.status] ?? stage.status}
                  value={stage.count}
                  sub={
                    stage.count > 0 ? (
                      <span className="space-y-0.5">
                        <span className={`block text-sm ${ageToneClass(tone)}`}>
                          Oldest {formatAgeMinutes(stage.oldestAgeMinutes)}
                        </span>
                        {stage.oldestCreatedAt ? (
                          <span className="block text-[11px] text-gray-400">
                            since {formatStoreDateTimeShort(stage.oldestCreatedAt)}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      'No orders'
                    )
                  }
                />
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
