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
import { ZraNotEnabledNotice } from '@/components/zra/ZraNotEnabledNotice';
import { useZraStore, ZraStoreSelector } from '@/components/zra/ZraStoreSelector';
import {
  zraApi,
  ZraApiError,
  type ZraBranchInfo,
  type ZraStockItemsResult,
  type ZraStockPreview,
  type ZraStockStatus,
  type ZraStockSyncedSummary
} from '@/lib/zraApi';

const RUNNING_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'STARTED']);
const MASTER_PAGE_SIZE = 50;

export default function ZraStockPage() {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const { storeId, setStoreId, storeIdParam, validStore } = useZraStore();
  const [preview, setPreview] = useState<ZraStockPreview | null>(null);
  const [status, setStatus] = useState<ZraStockStatus | null>(null);
  const [branch, setBranch] = useState<ZraBranchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pushingMaster, setPushingMaster] = useState(false);
  const [notEnabled, setNotEnabled] = useState(false);
  const [notEnabledMessage, setNotEnabledMessage] = useState<string | null>(null);
  const [zraStockItems, setZraStockItems] = useState<ZraStockItemsResult | null>(null);
  const [zraStockItemsLoading, setZraStockItemsLoading] = useState(false);
  const [syncedSummary, setSyncedSummary] = useState<ZraStockSyncedSummary | null>(null);
  const [masterQInput, setMasterQInput] = useState('');
  const [masterQ, setMasterQ] = useState('');
  const [masterPage, setMasterPage] = useState(0);
  const [masterLoading, setMasterLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const masterPageRef = useRef(0);
  const masterQRef = useRef('');
  const fetchGenRef = useRef(0);

  const sid = storeIdParam ?? 0;

  useEffect(() => {
    masterPageRef.current = masterPage;
  }, [masterPage]);
  useEffect(() => {
    masterQRef.current = masterQ;
  }, [masterQ]);

  const load = useCallback(async () => {
    if (!validStore || storeIdParam == null) {
      setPreview(null);
      setStatus(null);
      setBranch(null);
      setNotEnabled(false);
      setNotEnabledMessage(null);
      setZraStockItems(null);
      setSyncedSummary(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setNotEnabled(false);
    setNotEnabledMessage(null);
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
      setPreview(null);
      setStatus(null);
      setBranch(null);
      const msg = err instanceof ZraApiError ? err.message : 'Failed to load stock sync status.';
      if (err instanceof ZraApiError && /ZRA is not enabled for store/i.test(msg)) {
        setNotEnabled(true);
        setNotEnabledMessage(msg);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [validStore, storeIdParam]);

  const fetchSynced = useCallback(async (store: number, page: number, q: string) => {
    const gen = ++fetchGenRef.current;
    setMasterLoading(true);
    try {
      const synced = await zraApi.getStockSyncedSummary(store, {
        page,
        size: MASTER_PAGE_SIZE,
        q
      });
      if (gen !== fetchGenRef.current) return;
      setSyncedSummary(synced);
    } catch {
      if (gen !== fetchGenRef.current) return;
      setSyncedSummary(null);
    } finally {
      if (gen === fetchGenRef.current) setMasterLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchGenRef.current += 1;
    setMasterQInput('');
    setMasterQ('');
    setMasterPage(0);
    setSyncedSummary(null);
    setZraStockItems(null);
  }, [storeIdParam]);

  useEffect(() => {
    if (!validStore || storeIdParam == null || notEnabled) {
      setSyncedSummary(null);
      return;
    }
    void fetchSynced(storeIdParam, masterPage, masterQ);
  }, [validStore, storeIdParam, masterPage, masterQ, fetchSynced, notEnabled]);

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
          await fetchSynced(sid, masterPageRef.current, masterQRef.current);
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

  async function checkStockOnZra() {
    if (!validStore || storeIdParam == null) return;
    setZraStockItemsLoading(true);
    try {
      setZraStockItems(await zraApi.getStockItemsFromZra(storeIdParam));
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Failed to fetch stock items from ZRA.');
    } finally {
      setZraStockItemsLoading(false);
    }
  }

  async function handleOpeningBalance() {
    if (!validStore) return;
    if (
      !window.confirm(
        `Post opening balance for store ${sid}?\n\nThis saves stock master (current on-hand for every SKU) AND unlocks daily Sync stock. With a large catalog this can take several minutes — it now runs in the background, so it's safe to navigate away and check back.`
      )
    ) {
      return;
    }
    setOpening(true);
    try {
      const result = await zraApi.postOpeningBalance(sid, user?.username);
      setStatus(result);
      toast.push('success', `Opening balance started (job ${String(result.jobId ?? 'n/a')}). Running in the background…`);
      startPolling();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Opening balance failed to start.');
    } finally {
      setOpening(false);
    }
  }

  async function handlePushStockMaster() {
    if (!validStore) return;
    if (
      !window.confirm(
        `Save stock master for store ${sid}?\n\nThis re-pushes current on-hand quantities to ZRA (saveStockMaster only) in the background — it does NOT change the opening-balance flag or unlock sync.`
      )
    ) {
      return;
    }
    setPushingMaster(true);
    try {
      const result = await zraApi.pushStockMaster(sid, user?.username);
      setStatus(result);
      toast.push('success', `Stock master push started (job ${String(result.jobId ?? 'n/a')}). Running in the background…`);
      startPolling();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Save stock master failed to start.');
    } finally {
      setPushingMaster(false);
    }
  }

  const statusLabel = status?.status ?? '—';
  const isRunning = RUNNING_STATUSES.has(String(statusLabel).toUpperCase()) || syncing;
  const masterRows = syncedSummary?.master?.rows ?? syncedSummary?.master?.sample ?? [];
  const masterMatched = syncedSummary?.master?.matched ?? syncedSummary?.master?.succeeded ?? 0;
  const masterPageCount = Math.max(1, Math.ceil(masterMatched / MASTER_PAGE_SIZE));

  function searchMaster(e: React.FormEvent) {
    e.preventDefault();
    setMasterPage(0);
    setMasterQ(masterQInput.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ZRA Stock Sync</h1>
          <p className="text-sm text-gray-500">
            Post opening balance once (saves stock master), then sync stock daily. Use Save stock
            master any time to re-push current on-hand quantities.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <ZraStoreSelector storeId={storeId} onStoreChange={setStoreId} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              void load();
              if (storeIdParam != null) void fetchSynced(storeIdParam, masterPage, masterQ);
            }}
            disabled={loading || masterLoading || !validStore}
          >
            {loading ? <Spinner className="h-4 w-4" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {!validStore ? (
        <Card>
          <p className="text-sm text-gray-500">Select a store to view stock sync status.</p>
        </Card>
      ) : notEnabled ? (
        <ZraNotEnabledNotice storeId={storeIdParam} message={notEnabledMessage} />
      ) : loading && !preview ? (
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
                  title="saveStockMaster for every SKU, then unlock Sync stock (once)"
                >
                  {opening ? <Spinner className="h-4 w-4" /> : 'Post opening balance (stock master + unlock)'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={finance.loading || !finance.allowed || !validStore || pushingMaster || isRunning}
                  onClick={handlePushStockMaster}
                  title="saveStockMaster only — re-run anytime, doesn't unlock sync"
                >
                  {pushingMaster ? <Spinner className="h-4 w-4" /> : 'Save stock master only'}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Both call the same VSDC endpoint (<span className="font-mono">saveStockMaster</span>
                ) for every SKU — this can take several minutes on a large catalog and now runs in
                the background.{' '}
                <span className="font-medium text-gray-700">Opening balance</span> = stock master +
                unlocks Sync stock (run once first).{' '}
                <span className="font-medium text-gray-700">Stock master only</span> = re-push
                quantities anytime (demo / correction) without touching that unlock flag.
              </p>
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

          <Card>
            <SectionTitle
              action={
                masterLoading ? <Spinner className="h-4 w-4" /> : undefined
              }
            >
              Stock master synced to ZRA
            </SectionTitle>
            <p className="mb-2 text-xs text-gray-500">
              On-hand quantities we successfully pushed via <code className="text-[11px]">saveStockMaster</code>.
              VSDC has no read-back API for stock master — this outbox is the reconciliation source.
            </p>
            {syncedSummary?.master ? (
              <>
                <dl className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Stat label="Master OK" value={String(syncedSummary.master.succeeded ?? 0)} />
                  <Stat label="Master failed" value={String(syncedSummary.master.failed ?? 0)} />
                  <Stat
                    label="Sales pushed"
                    value={String(syncedSummary.movements?.SALE?.succeeded ?? 0)}
                  />
                  <Stat
                    label="Purchases pushed"
                    value={String(syncedSummary.movements?.PURCHASE?.succeeded ?? 0)}
                  />
                </dl>
                <form onSubmit={searchMaster} className="mb-3 flex flex-wrap items-end gap-3">
                  <Field label="Search SKU" className="min-w-[220px] flex-1">
                    <input
                      className="input font-mono"
                      value={masterQInput}
                      onChange={(e) => setMasterQInput(e.target.value)}
                      placeholder="e.g. BANJA or SPAGHETTI"
                    />
                  </Field>
                  <button type="submit" className="btn-ghost" disabled={masterLoading}>
                    Search
                  </button>
                  {masterQ ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={masterLoading}
                      onClick={() => {
                        setMasterQInput('');
                        setMasterQ('');
                        setMasterPage(0);
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </form>
                {masterRows.length > 0 ? (
                  <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">SKU</th>
                          <th className="px-3 py-2 font-medium">Qty (rsdQty)</th>
                          <th className="px-3 py-2 font-medium">Synced at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterRows.map((row) => (
                          <tr key={row.id ?? row.sku} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 font-mono text-gray-800">{row.sku}</td>
                            <td className="px-3 py-1.5 text-gray-700">{row.qty ?? '—'}</td>
                            <td className="px-3 py-1.5 text-gray-500">
                              {row.syncedAt ? formatDate(row.syncedAt) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {masterQ
                      ? `No synced SKUs matching “${masterQ}”.`
                      : 'No stock master rows synced yet.'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    {masterQ
                      ? `${masterMatched} matching of ${syncedSummary.master.succeeded ?? 0} SKUs`
                      : `${syncedSummary.master.succeeded ?? 0} SKUs`}
                    {masterRows.length > 0
                      ? ` · page ${masterPage + 1} of ${masterPageCount}`
                      : ''}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      disabled={masterLoading || masterPage === 0}
                      onClick={() => setMasterPage((p) => Math.max(0, p - 1))}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      disabled={
                        masterLoading || (masterPage + 1) * MASTER_PAGE_SIZE >= masterMatched
                      }
                      onClick={() => setMasterPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : masterLoading ? (
              <p className="text-sm text-gray-400">Loading synced stock master…</p>
            ) : (
              <p className="text-sm text-gray-400">No synced stock master data yet.</p>
            )}
          </Card>

          <Card>
            <SectionTitle
              action={
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={zraStockItemsLoading}
                  onClick={() => void checkStockOnZra()}
                >
                  {zraStockItemsLoading ? <Spinner className="h-3.5 w-3.5" /> : 'Fetch from VSDC'}
                </button>
              }
            >
              Stock movements on VSDC (selectStockItems)
            </SectionTitle>
            <p className="mb-2 text-xs text-gray-500">
              Inbound <em>branch-to-branch</em> stock moves from ZRA (
              <code className="text-[11px]">selectStockItems</code>
              ). This is not on-hand qty and not our own sales/purchase movements. Empty (
              result 001) is normal when no other branch has transferred stock to this device.
            </p>
            {zraStockItems == null ? (
              <p className="text-sm text-gray-400">Not fetched yet — click Fetch from VSDC.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-600">
                  VSDC result: <Badge>{zraStockItems.resultCd ?? '—'}</Badge>{' '}
                  {zraStockItems.message ?? ''}
                  {zraStockItems.movementCount != null && zraStockItems.movementCount > 0
                    ? ` · ${zraStockItems.movementCount} movement(s)`
                    : ''}
                </p>
                {zraStockItems.stockList && zraStockItems.stockList.length > 0 ? (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                    {JSON.stringify(zraStockItems.stockList, null, 2)}
                  </pre>
                ) : zraStockItems.data ? (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                    {JSON.stringify(zraStockItems.data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500">
                    {zraStockItems.resultCd === '001'
                      ? 'VSDC returned no inbound branch stock moves (result 001). Use the stock master table above to confirm on-hand we pushed.'
                      : zraStockItems.message || 'No movement records returned.'}
                  </p>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
