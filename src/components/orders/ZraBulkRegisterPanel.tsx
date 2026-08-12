'use client';

import { useState } from 'react';
import {
  zraApi,
  ZraApiError,
  type BulkRegisterZraItemsResponse,
  type BulkRegisterZraItemResult,
  type ZraItemRegistrationStatus,
  type ZraItemsListResult
} from '@/lib/zraApi';
import { useAuth } from '@/lib/store';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { useZraStore, ZraStoreSelector } from '@/components/zra/ZraStoreSelector';
import { SkuMultiPicker } from '@/components/zra/SkuPicker';
import { Badge, Card, Spinner, useToast } from '@/components/ui';

function statusTone(status: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'REGISTERED':
    case 'WOULD_REGISTER':
      return status === 'WOULD_REGISTER' ? 'amber' : 'green';
    case 'ALREADY_EXISTS':
      return 'blue';
    case 'FAILED':
      return 'red';
    case 'SKIPPED':
      return 'gray';
    default:
      return 'gray';
  }
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' | 'amber' | 'blue' | 'gray' }) {
  const color =
    tone === 'green' ? 'text-green-700' :
    tone === 'red' ? 'text-red-700' :
    tone === 'amber' ? 'text-amber-700' :
    tone === 'blue' ? 'text-blue-700' :
    'text-gray-700';
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ResultsTable({ results, filter }: { results: BulkRegisterZraItemResult[]; filter: 'all' | 'issues' }) {
  const rows = filter === 'issues'
    ? results.filter(r => r.status === 'FAILED' || r.status === 'SKIPPED')
    : results;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {filter === 'issues' ? 'No failures or skipped items.' : 'No results.'}
      </p>
    );
  }

  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Tax</th>
            <th className="px-3 py-2 font-medium">Class</th>
            <th className="px-3 py-2 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.itemCd} className="border-t border-gray-50 align-top">
              <td className="px-3 py-2 font-mono">{row.itemCd}</td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </td>
              <td className="px-3 py-2">{row.taxTyCd ?? '—'}</td>
              <td className="px-3 py-2 font-mono">{row.itemClsCd ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 break-words max-w-xs">{row.message ?? row.itemNm ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ZraBulkRegisterPanel() {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const finance = useZraFinanceAccess();
  const { storeId, setStoreId, storeIdParam, validStore } = useZraStore();
  const [skus, setSkus] = useState<string[]>([]);
  const [includeFeeItem, setIncludeFeeItem] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkRegisterZraItemsResponse | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const [regStatus, setRegStatus] = useState<Record<string, ZraItemRegistrationStatus | 'loading' | 'error'>>({});
  const [itemsList, setItemsList] = useState<ZraItemsListResult | null>(null);
  const [itemsListLoading, setItemsListLoading] = useState(false);

  async function fetchItemsFromZra() {
    if (!validStore || storeIdParam == null) return;
    setItemsListLoading(true);
    try {
      const res = await zraApi.getItemsFromZra(storeIdParam);
      setItemsList(res);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Failed to fetch item list from ZRA.');
    } finally {
      setItemsListLoading(false);
    }
  }

  async function checkRegistration() {
    if (!validStore || storeIdParam == null || skus.length === 0) return;
    setRegStatus((s) => {
      const next = { ...s };
      for (const sku of skus) next[sku] = 'loading';
      return next;
    });
    await Promise.all(
      skus.map(async (sku) => {
        try {
          const status = await zraApi.getItemRegistrationStatus(sku, storeIdParam);
          setRegStatus((s) => ({ ...s, [sku]: status }));
        } catch {
          setRegStatus((s) => ({ ...s, [sku]: 'error' }));
        }
      })
    );
  }

  async function run(dryRun: boolean) {
    if (!dryRun && skus.length === 0) {
      const ok = confirm(
        'Register ALL active catalog products with ZRA?\n\nThis calls saveItem for every active SKU. Prefer Preview mapping first.'
      );
      if (!ok) return;
    }

    setRunning(true);
    setResult(null);
    try {
      const response = await zraApi.registerItems({
        storeId: storeIdParam,
        skus: skus.length > 0 ? skus : undefined,
        includeFeeItem,
        dryRun,
        adminUser: user?.username
      });
      setResult(response);
      setShowAllResults(false);
      if (dryRun) {
        toast.push('success', `Preview ready — ${response.total} item(s) would be registered.`);
      } else if (response.failed > 0) {
        toast.push('error', `Registration finished with ${response.failed} failure(s).`);
      } else {
        toast.push('success', `Registered ${response.registered + response.alreadyExists} item(s) with ZRA.`);
      }
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'ZRA registration failed.');
    } finally {
      setRunning(false);
    }
  }

  const hasSkus = skus.length > 0;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">ZRA catalog registration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Bulk-register active products with ZRA via saveItem. Leave SKUs empty to register the full catalog.
          Per-order lazy registration still runs on delivery.
        </p>
      </div>

      <ZraStoreSelector storeId={storeId} onStoreChange={setStoreId} />

      <SkuMultiPicker
        skus={skus}
        onChange={setSkus}
        label="SKUs (optional — search to add, leave empty for the full catalog)"
        hint={hasSkus ? 'Selected SKUs only' : 'All active catalog products will be used'}
        renderBadge={(sku) => {
          const s = regStatus[sku];
          if (!s) return null;
          if (s === 'loading') return <Spinner className="h-3 w-3" />;
          if (s === 'error') return <Badge tone="gray">Unknown</Badge>;
          return (
            <span title={s.message ?? undefined}>
              <Badge tone={s.registered ? 'green' : 'amber'}>
                {s.registered ? 'Registered' : 'Not registered'}
              </Badge>
            </span>
          );
        }}
      />

      {hasSkus && (
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={!validStore}
          onClick={() => void checkRegistration()}
          title={
            !validStore
              ? 'Select a store first'
              : "Best-effort check via VSDC's items/selectItem — one call per SKU."
          }
        >
          Check ZRA registration status
        </button>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={includeFeeItem}
          onChange={e => setIncludeFeeItem(e.target.checked)}
          disabled={running}
        />
        Also register delivery fee line (SVC-FEES)
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={running || !validStore}
          onClick={() => void run(true)}
        >
          {running ? <Spinner className="h-4 w-4" /> : 'Preview mapping'}
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={running || finance.loading || !finance.allowed || !validStore}
          onClick={() => void run(false)}
        >
          {running ? <Spinner className="h-4 w-4" /> : hasSkus ? 'Register selected' : 'Register all active'}
        </button>
      </div>

      <ZraFinanceNotice access={finance} />

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Item list on ZRA record</h3>
            <p className="text-xs text-gray-500">
              "Get Item List" (items/selectItems) — read-only reconciliation of everything VSDC has
              on file for this store, independent of our local registration status above.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost text-xs shrink-0"
            disabled={itemsListLoading || !validStore}
            onClick={() => void fetchItemsFromZra()}
          >
            {itemsListLoading ? <Spinner className="h-3 w-3" /> : 'Fetch from ZRA'}
          </button>
        </div>
        {itemsList && (
          <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
            <p className="text-gray-700">
              {itemsList.resultCd ? `[${itemsList.resultCd}] ` : ''}
              {itemsList.message ?? 'No message returned.'}
            </p>
            {itemsList.data != null && (
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] text-gray-600">
                {JSON.stringify(itemsList.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {result.dryRun ? 'Preview results' : 'Registration results'}
            </span>
            {result.dryRun && <Badge tone="amber">DRY RUN</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <SummaryStat label="Total" value={result.total} />
            <SummaryStat label={result.dryRun ? 'Would register' : 'Registered'} value={result.registered} tone="green" />
            <SummaryStat label="Already exists" value={result.alreadyExists} tone="blue" />
            <SummaryStat label="Failed" value={result.failed} tone="red" />
            <SummaryStat label="Skipped" value={result.skipped} tone="gray" />
          </div>

          <ResultsTable results={result.results} filter="issues" />

          {result.results.length > 0 && (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => setShowAllResults(v => !v)}
            >
              {showAllResults ? 'Hide full results' : `Show all ${result.results.length} items`}
            </button>
          )}

          {showAllResults && <ResultsTable results={result.results} filter="all" />}
        </div>
      )}
    </Card>
  );
}
