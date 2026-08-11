'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  Loading,
  SectionTitle,
  Spinner,
  Stat,
  formatDate,
  useToast
} from '@/components/ui';
import { useAuth } from '@/lib/store';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { useZraStore, ZraStoreSelector } from '@/components/zra/ZraStoreSelector';
import {
  zraApi,
  ZraApiError,
  type ZraBranchInfo,
  type ZraStockPreview,
  type ZraStockStatus
} from '@/lib/zraApi';

const RUNNING_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'STARTED']);

export default function ZraStockPage() {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const { storeId, storeIdParam, validStore, loading: storesLoading } = useZraStore();
  const [preview, setPreview] = useState<ZraStockPreview | null>(null);
  const [status, setStatus] = useState<ZraStockStatus | null>(null);
  const [branch, setBranch] = useState<ZraBranchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [opening, setOpening] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sid = storeIdParam ?? 0;

  const load = useCallback(async () => {
    if (storesLoading) return;
    if (!validStore || storeIdParam == null) {
      setPreview(null);
      setStatus(null);
      setBranch(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, s, b] = await Promise.all([
        zraApi.getStockPreview(storeIdParam),
        zraApi.getStockSyncStatus(storeIdParam),
        zraApi.getBranch(storeIdParam).catch(() => null)
      ]);
      setPreview(p);
      setStatus(s);
      setBranch(b);
    } catch (err) {
      setError(err instanceof ZraApiError ? err.message : 'Failed to load stock sync status.');
      setPreview(null);
      setStatus(null);
      setBranch(null);
    } finally {
      setLoading(false);
    }
  }, [validStore, storeIdParam, storesLoading]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!validStore) return;
      try {
        const s = await zraApi.getStockSyncStatus(sid);
        setStatus(s);
        if (!RUNNING_STATUSES.has(String(s.status ?? '').toUpperCase())) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncing(false);
          const p = await zraApi.getStockPreview(sid);
          setPreview(p);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }

  async function handleSync() {
    if (!validStore) return;
    if (!window.confirm(`Start stock sync for store ${sid}?`)) return;
    setSyncing(true);
    try {
      const s = await zraApi.syncStock(sid, user?.username);
      setStatus(s);
      toast.push('success', `Stock sync started (job ${s.jobId || 'n/a'}).`);
      startPolling();
    } catch (err) {
      setSyncing(false);
      toast.push('error', err instanceof ZraApiError ? err.message : 'Stock sync failed.');
    }
  }

  async function handleOpeningBalance() {
    if (!validStore) return;
    if (
      !window.confirm(
        `Post opening balance for store ${sid}? This registers current stock as opening balance with ZRA.`
      )
    ) {
      return;
    }
    setOpening(true);
    try {
      const result = await zraApi.postOpeningBalance(sid, user?.username);
      toast.push('success', `Opening balance posted (job ${String(result.jobId ?? 'n/a')}).`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Opening balance failed.');
    } finally {
      setOpening(false);
    }
  }

  const statusLabel = status?.status ?? '—';
  const isRunning = RUNNING_STATUSES.has(String(statusLabel).toUpperCase()) || syncing;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ZRA Stock Sync</h1>
          <p className="text-sm text-gray-500">
            Post opening balance once, then sync stock daily. Sync is blocked until opening balance succeeds.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <ZraStoreSelector />
          <button type="button" className="btn-ghost" onClick={load} disabled={loading || !validStore}>
            {loading ? <Spinner className="h-4 w-4" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {loading && !preview ? (
        <Loading label="Loading stock preview…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Pending sales" value={preview?.pendingSales ?? 0} />
            <Stat label="Pending credits" value={preview?.pendingCredits ?? 0} />
            <Stat label="Pending purchases" value={preview?.pendingPurchases ?? 0} />
            <Stat label="Pending adjustments" value={preview?.pendingAdjustments ?? 0} />
            <Stat label="Pending total" value={preview?.pendingTotal ?? 0} />
          </div>

          {(branch || status?.bhfId) && (
            <Card>
              <SectionTitle>ZRA device for this store</SectionTitle>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">bhfId</dt>
                  <dd className="font-mono text-gray-900">{branch?.bhfId || status?.bhfId || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">TPIN</dt>
                  <dd className="font-mono text-gray-900">{branch?.tpin || '—'}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-gray-500">VSDC URL</dt>
                  <dd className="break-all font-mono text-xs text-gray-900">{branch?.baseUrl || '—'}</dd>
                </div>
              </dl>
            </Card>
          )}

          <Card>
            <SectionTitle>Actions</SectionTitle>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={finance.loading || !finance.allowed || !validStore || isRunning}
                  onClick={handleSync}
                >
                  {isRunning ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-4 w-4" /> Syncing…
                    </span>
                  ) : (
                    'Sync stock'
                  )}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={finance.loading || !finance.allowed || !validStore || opening || isRunning}
                  onClick={handleOpeningBalance}
                >
                  {opening ? <Spinner className="h-4 w-4" /> : 'Post opening balance'}
                </button>
              </div>
              <ZraFinanceNotice access={finance} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Job / status</SectionTitle>
            {status ? (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-gray-500">Status</dt>
                  <dd className="mt-0.5">
                    <Badge tone={isRunning ? 'amber' : statusLabel === 'SUCCESS' || statusLabel === 'COMPLETED' ? 'green' : 'gray'}>
                      {statusLabel}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-gray-500">Job ID</dt>
                  <dd className="mt-0.5 font-mono text-xs text-gray-900">{status.jobId || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-gray-500">Last sync</dt>
                  <dd className="mt-0.5 text-gray-900">
                    {status.lastSyncAt ? formatDate(status.lastSyncAt) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-gray-500">Last started</dt>
                  <dd className="mt-0.5 text-gray-900">
                    {status.lastSyncStartedAt ? formatDate(status.lastSyncStartedAt) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-gray-500">Opening balance</dt>
                  <dd className="mt-0.5 text-gray-900">
                    {status.openingBalancePostedAt
                      ? formatDate(status.openingBalancePostedAt)
                      : 'Not posted'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-gray-500">Pending/failed outbox</dt>
                  <dd className="mt-0.5 text-gray-900">{status.pendingOrFailedOutbox ?? 0}</dd>
                </div>
                {status.lastError && (
                  <div className="sm:col-span-2">
                    <ErrorBox message={status.lastError} />
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-gray-400">No status loaded.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
