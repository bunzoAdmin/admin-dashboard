'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/store';
import { readStoreId } from '@/lib/storeSession';
import { UNSTARTED_PICK_KINDS, useOpsAlerts } from '@/lib/opsAlerts';
import { pickerApi } from '@/lib/pickerApi';
import { useToast } from './ui';

const POLL_MS = 30_000;

const PINNED_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID
  ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_STORE_ID, 10)
  : null;

export function OpsWatcher() {
  const token = useAuth((s) => s.token);
  const setAttentionCount = useOpsAlerts((s) => s.setAttentionCount);
  const setUnstartedPickCount = useOpsAlerts((s) => s.setUnstartedPickCount);
  const setAbandonedReconcileCount = useOpsAlerts((s) => s.setAbandonedReconcileCount);
  const { push } = useToast();
  const prevUnstarted = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    prevUnstarted.current = null;

    async function poll() {
      const storeId = PINNED_STORE_ID ?? readStoreId();
      if (storeId == null) {
        if (!active) return;
        setAttentionCount(0);
        setUnstartedPickCount(0);
        setAbandonedReconcileCount(0);
        return;
      }

      try {
        const [attention, reconcile] = await Promise.all([
          pickerApi.listAttention(storeId, 5).catch(() => ({ items: [], total: 0 })),
          pickerApi
            .listReconcileFailures(0, 100, storeId)
            .catch(() => [] as Awaited<ReturnType<typeof pickerApi.listReconcileFailures>>)
        ]);
        if (!active) return;
        const unstarted = attention.items.filter((i) => UNSTARTED_PICK_KINDS.has(i.kind)).length;
        setAttentionCount(attention.total);
        setUnstartedPickCount(unstarted);
        setAbandonedReconcileCount(reconcile.filter((r) => r.status === 'ABANDONED').length);

        if (prevUnstarted.current !== null && unstarted > prevUnstarted.current) {
          const delta = unstarted - prevUnstarted.current;
          push(
            'error',
            `${delta} order${delta > 1 ? 's' : ''} confirmed with pick not started`
          );
        }
        prevUnstarted.current = unstarted;
      } catch {
        // transient — next tick retries
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, setAttentionCount, setUnstartedPickCount, setAbandonedReconcileCount, push]);

  return null;
}
