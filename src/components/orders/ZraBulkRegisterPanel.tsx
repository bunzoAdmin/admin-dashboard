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
import { SkuPicker } from '@/components/zra/SkuPicker';
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

function ResultsTable({ results }: { results: BulkRegisterZraItemResult[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500">No results.</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border border-gray-100">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Tax</th>
            <th className="px-3 py-2 font-medium">Class</th>
            <th className="px-3 py-2 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.itemCd} className="border-t border-gray-50 align-top">
              <td className="px-3 py-2 font-mono">{row.itemCd}</td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </td>
              <td className="px-3 py-2">{row.taxTyCd ?? '—'}</td>
              <td className="px-3 py-2 font-mono">{row.itemClsCd ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 break-words max-w-xs">
                {row.message ?? row.itemNm ?? '—'}
              </td>
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
  const [sku, setSku] = useState('');
  const [includeFeeItem, setIncludeFeeItem] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkRegisterZraItemsResponse | null>(null);
  const [regStatus, setRegStatus] = useState<ZraItemRegistrationStatus | 'loading' | 'error' | null>(
    null
  );
  const [itemsList, setItemsList] = useState<ZraItemsListResult | null>(null);
  const [itemsListLoading, setItemsListLoading] = useState(false);

  const selectedSku = sku.trim();

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
    if (!validStore || storeIdParam == null || !selectedSku) return;
    setRegStatus('loading');
    try {
      setRegStatus(await zraApi.getItemRegistrationStatus(selectedSku, storeIdParam));
    } catch {
      setRegStatus('error');
    }
  }

  async function run(dryRun: boolean) {
    if (!selectedSku) {
      toast.push('error', 'Select one SKU to register.');
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const response = await zraApi.registerItems({
        storeId: storeIdParam,
        skus: [selectedSku],
        includeFeeItem,
        dryRun,
        adminUser: user?.username
      });
      setResult(response);
      if (dryRun) {
        toast.push('success', `Preview ready for ${selectedSku}.`);
      } else if (response.failed > 0) {
        toast.push('error', `Registration failed for ${selectedSku}.`);
      } else {
        toast.push('success', `Registered ${selectedSku} with ZRA.`);
      }
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'ZRA registration failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">ZRA item registration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Register one catalog SKU at a time via VSDC saveItem. Full-catalog register is not
          supported — VSDC has no bulk saveItem API. Unregistered SKUs are still registered lazily
          on delivery.
        </p>
      </div>

      <ZraStoreSelector storeId={storeId} onStoreChange={setStoreId} />

      <SkuPicker
        value={sku}
        onChange={(next) => {
          setSku(next);
          setRegStatus(null);
        }}
        label="SKU"
        placeholder="Search by name or SKU…"
      />

      {selectedSku && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={!validStore || regStatus === 'loading'}
            onClick={() => void checkRegistration()}
          >
            {regStatus === 'loading' ? <Spinner className="h-3 w-3" /> : 'Check ZRA registration'}
          </button>
          {regStatus && regStatus !== 'loading' && (
            regStatus === 'error' ? (
              <Badge tone="gray">Unknown</Badge>
            ) : (
              <Badge tone={regStatus.registered ? 'green' : 'amber'}>
                {regStatus.registered ? 'Registered' : 'Not registered'}
              </Badge>
            )
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={includeFeeItem}
          onChange={(e) => setIncludeFeeItem(e.target.checked)}
          disabled={running}
        />
        Also register delivery fee line (SVC-FEES)
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={running || !validStore || !selectedSku}
          onClick={() => void run(true)}
        >
          {running ? <Spinner className="h-4 w-4" /> : 'Preview mapping'}
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={running || finance.loading || !finance.allowed || !validStore || !selectedSku}
          onClick={() => void run(false)}
        >
          {running ? <Spinner className="h-4 w-4" /> : 'Register SKU'}
        </button>
      </div>

      <ZraFinanceNotice access={finance} />

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Item list on ZRA record</h3>
            <p className="text-xs text-gray-500">
              &quot;Get Item List&quot; (items/selectItems) — read-only list of items VSDC has on file
              for this store.
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
              {result.dryRun ? 'Preview result' : 'Registration result'}
            </span>
            {result.dryRun && <Badge tone="amber">DRY RUN</Badge>}
          </div>
          <ResultsTable results={result.results} />
        </div>
      )}
    </Card>
  );
}
