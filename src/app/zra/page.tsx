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
import { useAuth } from '@/lib/store';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
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
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const { storeId, storeIdParam, storeIdLabel } = useZraStore();
  const [data, setData] = useState<ZraOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditOrder, setCreditOrder] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await zraApi.getOverview(storeIdParam));
    } catch (err) {
      setError(err instanceof ZraApiError ? err.message : 'Failed to load ZRA overview.');
    } finally {
      setLoading(false);
    }
  }, [storeIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  const stock = data?.stock && 'status' in data.stock ? data.stock : null;
  const branch: ZraBranchInfo | null =
    data?.branch && typeof data.branch === 'object' ? data.branch : null;

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
          <ZraStoreSelector />
          <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {loading && !data ? (
        <Loading label="Loading ZRA overview…" />
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
                    : 'Set store ID'
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
                <p className="text-sm text-gray-400">Enter a store ID and refresh to load stock status.</p>
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
            {!finance.allowed && !finance.loading && (
              <ZraFinanceNotice access={finance} className="mt-2" />
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
