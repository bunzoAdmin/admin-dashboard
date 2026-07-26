'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/store';
import { readStoreId } from '@/lib/storeSession';
import { useOpsAlerts } from '@/lib/opsAlerts';
import { pickerApi } from '@/lib/pickerApi';

const POLL_MS = 30_000;

const PINNED_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID
  ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_STORE_ID, 10)
  : null;

export function OpsWatcher() {
  const token = useAuth((s) => s.token);
  const setAttentionCount = useOpsAlerts((s) => s.setAttentionCount);
  const setAbandonedReconcileCount = useOpsAlerts((s) => s.setAbandonedReconcileCount);

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function poll() {
      if (typeof document !== 'undefined' && document.hidden) return;
      const storeId = PINNED_STORE_ID ?? readStoreId();
      if (storeId == null) {
        if (!active) return;
        setAttentionCount(0);
        setAbandonedReconcileCount(0);
        return;
      }

      try {
        const [attention, reconcile] = await Promise.all([
          pickerApi.listAttention(storeId, 5).catch(() => ({ items: [], total: 0 })),
          pickerApi.listReconcileFailures(0, 100, storeId).catch(() => [] as Awaited<ReturnType<typeof pickerApi.listReconcileFailures>>)
        ]);
        if (!active) return;
        setAttentionCount(attention.total);
        setAbandonedReconcileCount(reconcile.filter((r) => r.status === 'ABANDONED').length);
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
  }, [token, setAttentionCount, setAbandonedReconcileCount]);

  return null;
}
