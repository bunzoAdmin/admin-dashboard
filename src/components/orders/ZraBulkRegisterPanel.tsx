'use client';

import { useState } from 'react';
import {
  zraApi,
  ZraApiError,
  type BulkRegisterZraItemsResponse,
  type BulkRegisterZraItemResult
} from '@/lib/zraApi';
import { Badge, Card, Spinner, useToast } from '@/components/ui';

function parseSkus(raw: string): string[] | undefined {
  const skus = raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return skus.length > 0 ? skus : undefined;
}

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
  const [skuText, setSkuText] = useState('');
  const [includeFeeItem, setIncludeFeeItem] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkRegisterZraItemsResponse | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);

  async function run(dryRun: boolean) {
    const skus = parseSkus(skuText);
    if (!dryRun && skus == null) {
      const ok = confirm(
        'Register ALL active catalog products with ZRA?\n\nThis calls saveItem for every active SKU. Prefer Preview mapping first.'
      );
      if (!ok) return;
    }

    setRunning(true);
    setResult(null);
    try {
      const response = await zraApi.registerItems({
        skus,
        includeFeeItem,
        dryRun
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

  const hasSkus = parseSkus(skuText) != null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">ZRA catalog registration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Bulk-register active products with ZRA via saveItem. Leave SKUs empty to register the full catalog.
          Per-order lazy registration still runs on delivery.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="label">SKUs (optional — one per line or comma-separated)</span>
        <textarea
          className="input w-full min-h-[88px] font-mono text-xs"
          placeholder={'ALERT-BREAD-500G\nALERT-OIL-1L\n\nLeave empty to register all active products'}
          value={skuText}
          onChange={e => setSkuText(e.target.value)}
          disabled={running}
        />
        <p className="text-xs text-gray-500">
          {hasSkus ? 'Selected SKUs only' : 'All active catalog products will be used'}
        </p>
      </label>

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
          disabled={running}
          onClick={() => void run(true)}
        >
          {running ? <Spinner className="h-4 w-4" /> : 'Preview mapping'}
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={running}
          onClick={() => void run(false)}
        >
          {running ? <Spinner className="h-4 w-4" /> : hasSkus ? 'Register selected' : 'Register all active'}
        </button>
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
