'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  Loading,
  SectionTitle,
  Spinner,
  Stat,
  formatDate
} from '@/components/ui';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { ZraNotEnabledNotice } from '@/components/zra/ZraNotEnabledNotice';
import { useZraStore, ZraStoreSelector } from '@/components/zra/ZraStoreSelector';
import { zraApi, ZraApiError, type ZraBranchInfo, type ZraOverview } from '@/lib/zraApi';
import { CreditNotePanel } from '@/components/orders/CreditNotePanel';

function metaSub(meta?: { lastSyncedAt?: string | null; lastError?: string | null }) {
  if (!meta) return 'Never synced';
  if (meta.lastError) return `Error: ${meta.lastError}`;
  if (meta.lastSyncedAt) return `Last sync ${formatDate(meta.lastSyncedAt)}`;
  return 'No sync yet';
}

export default function ZraOverviewPage() {
  const finance = useZraFinanceAccess();
  const { storeId, setStoreId, storeIdParam, storeIdLabel, validStore } = useZraStore();
  const [data, setData] = useState<ZraOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditOrder, setCreditOrder] = useState('');
  const [zraRecord, setZraRecord] = useState<{ resultCd?: string | null; message?: string | null; data?: unknown } | null>(null);
  const [zraRecordLoading, setZraRecordLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);

  async function verifyBranchWithZra() {
    if (storeIdParam == null) return;
    setZraRecordLoading(true);
    try {
      const res = await zraApi.getBranchFromZra(storeIdParam);
      setZraRecord(res);
    } catch (err) {
      setZraRecord({ message: err instanceof ZraApiError ? err.message : 'Failed to fetch branch record from ZRA.' });
    } finally {
      setZraRecordLoading(false);
    }
  }

  async function registerBranchUser() {
    if (storeIdParam == null) return;
    setUserSaving(true);
    try {
      const res = await zraApi.saveBranchUser(storeIdParam, finance.username ?? undefined);
      setZraRecord({ resultCd: res.resultCd, message: res.message ?? (res.registered ? 'System user registered.' : undefined) });
    } catch (err) {
      setZraRecord({ message: err instanceof ZraApiError ? err.message : 'Failed to register branch user.' });
    } finally {
      setUserSaving(false);
    }
  }

  const load = useCallback(async () => {
    if (!validStore || storeIdParam == null) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await zraApi.getOverview(storeIdParam));
    } catch (err) {
      setData(null);
      setError(err instanceof ZraApiError ? err.message : 'Failed to load ZRA overview.');
    } finally {
      setLoading(false);
    }
  }, [storeIdParam, validStore]);

  useEffect(() => {
    load();
  }, [load]);

  const notEnabled = data != null && data.zraEnabled === false;
  const stock = !notEnabled && data?.stock && 'status' in data.stock ? data.stock : null;
  const branch: ZraBranchInfo | null =
    !notEnabled && data?.branch && typeof data.branch === 'object' ? data.branch : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ZRA Overview</h1>
          <p className="text-sm text-gray-500">
            Codes, purchases, and stock sync — one VSDC device / bhfId per store.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <ZraStoreSelector storeId={storeId} onStoreChange={setStoreId} />
          <button type="button" className="btn-ghost" onClick={load} disabled={loading || !validStore}>
            {loading ? <Spinner className="h-4 w-4" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {!validStore ? (
        <Card>
          <p className="text-sm text-gray-500">Select a store to view ZRA status for that dark store.</p>
        </Card>
      ) : loading && !data ? (
        <Loading label="Loading ZRA overview…" />
      ) : notEnabled ? (
        <ZraNotEnabledNotice
          storeId={storeIdParam}
          message={data?.message}
          enabledStoreIds={data?.enabledStoreIds}
        />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Standard codes"
              value={data.codes.standardCodeCount ?? 0}
              sub={metaSub(data.codes.codes)}
            />
            <Stat
              label="Classification codes"
              value={data.codes.itemClassCount ?? 0}
              sub={metaSub(data.codes.itemClass)}
            />
            <Stat
              label="Pending purchases"
              value={data.pendingPurchases ?? 0}
              sub={<Link href="/zra/purchases" className="text-blue-600 hover:underline">Review →</Link>}
            />
            <Stat
              label="Stock sync"
              value={stock?.status ?? '—'}
              sub={
                stock?.lastSyncAt
                  ? `Last sync ${formatDate(stock.lastSyncAt)}`
                  : stock
                    ? 'Never run'
                    : '—'
              }
            />
          </div>

          {branch && (
            <Card>
              <SectionTitle>ZRA device (store {branch.storeId ?? storeIdLabel})</SectionTitle>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Branch ID (bhfId)</dt>
                  <dd className="font-mono text-gray-900">{branch.bhfId || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">TPIN</dt>
                  <dd className="font-mono text-gray-900">{branch.tpin || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-gray-500">VSDC base URL</dt>
                  <dd className="break-all text-right font-mono text-xs text-gray-900">
                    {branch.baseUrl || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Device serial</dt>
                  <dd className="font-mono text-xs text-gray-900">{branch.deviceSerialNo || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Legal name</dt>
                  <dd className="text-right text-gray-900">{branch.legalName || '—'}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={zraRecordLoading}
                  onClick={() => void verifyBranchWithZra()}
                >
                  {zraRecordLoading ? <Spinner className="h-3 w-3" /> : 'Verify with ZRA'}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={userSaving || !finance.allowed}
                  title={!finance.allowed ? 'Finance admin only' : 'Register the CIS system user with this branch on VSDC'}
                  onClick={() => void registerBranchUser()}
                >
                  {userSaving ? <Spinner className="h-3 w-3" /> : 'Register system user'}
                </button>
                {zraRecord && (
                  <span className="text-xs text-gray-600">
                    {zraRecord.resultCd ? `[${zraRecord.resultCd}] ` : ''}
                    {zraRecord.message || (zraRecord.data ? 'ZRA returned branch data — see network tab / audit for full payload.' : '')}
                  </span>
                )}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle action={<Link href="/zra/codes" className="text-sm text-blue-600 hover:underline">Codes →</Link>}>
                Last code sync
              </SectionTitle>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Codes</dt>
                  <dd className="text-right text-gray-900">{metaSub(data.codes.codes)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Item class</dt>
                  <dd className="text-right text-gray-900">{metaSub(data.codes.itemClass)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Purchases fetch</dt>
                  <dd className="text-right text-gray-900">{metaSub(data.codes.purchases)}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <SectionTitle action={<Link href="/zra/stock" className="text-sm text-blue-600 hover:underline">Stock →</Link>}>
                Stock sync (store {storeIdLabel})
              </SectionTitle>
              {stock ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <Badge tone={stock.status === 'SUCCESS' || stock.status === 'COMPLETED' ? 'green' : stock.status === 'RUNNING' ? 'amber' : 'gray'}>
                        {stock.status ?? '—'}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Last sync</dt>
                    <dd className="text-gray-900">{stock.lastSyncAt ? formatDate(stock.lastSyncAt) : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Opening balance</dt>
                    <dd className="text-gray-900">
                      {stock.openingBalancePostedAt ? formatDate(stock.openingBalancePostedAt) : 'Not posted'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Pending/failed outbox</dt>
                    <dd className="text-gray-900">{stock.pendingOrFailedOutbox ?? 0}</dd>
                  </div>
                  {stock.lastError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">
                      {stock.lastError}
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-400">No stock status for this store.</p>
              )}
            </Card>
          </div>

          <Card>
            <SectionTitle>Issue credit note</SectionTitle>
            <Field label="Order number">
              <input
                className="input font-mono mb-3"
                value={creditOrder}
                onChange={(e) => setCreditOrder(e.target.value)}
                placeholder="ORD-…"
              />
            </Field>
            {creditOrder.trim() ? (
              <CreditNotePanel orderNumber={creditOrder.trim()} />
            ) : (
              <p className="text-xs text-gray-400">Enter an order number to issue a full or partial credit note.</p>
            )}
            <ZraFinanceNotice access={finance} className="mt-2" />
          </Card>
        </>
      ) : null}
    </div>
  );
}
