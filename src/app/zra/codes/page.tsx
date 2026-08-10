'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  SectionTitle,
  Spinner,
  useToast
} from '@/components/ui';
import { useAuth } from '@/lib/store';
import { isZraFinanceAdmin } from '@/lib/zraFinance';
import {
  zraApi,
  ZraApiError,
  type ZraItemClassCode,
  type ZraStandardCode
} from '@/lib/zraApi';

type Tab = 'standard' | 'classification';

export default function ZraCodesPage() {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const canFinance = isZraFinanceAdmin(user);
  const [tab, setTab] = useState<Tab>('standard');
  const [q, setQ] = useState('');
  const [cdCls, setCdCls] = useState('');
  const [page, setPage] = useState(0);
  const [standard, setStandard] = useState<ZraStandardCode[] | null>(null);
  const [classification, setClassification] = useState<ZraItemClassCode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [storeId, setStoreId] = useState('1');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'standard') {
        setStandard(await zraApi.listStandardCodes({ q: q || undefined, cdCls: cdCls || undefined, page, size: 50 }));
      } else {
        setClassification(await zraApi.listClassificationCodes({ q: q || undefined, page, size: 50 }));
      }
    } catch (err) {
      setError(err instanceof ZraApiError ? err.message : 'Failed to load codes.');
    } finally {
      setLoading(false);
    }
  }, [tab, q, cdCls, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    const sid = Number(storeId);
    const storeOk = Number.isFinite(sid) && sid > 0;
    if (
      !window.confirm(
        storeOk
          ? `Sync ZRA codes from store ${sid}'s VSDC device?`
          : 'Sync ZRA codes from the default/first enabled VSDC?'
      )
    ) {
      return;
    }
    setSyncing(true);
    try {
      await zraApi.syncCodes(storeOk ? sid : undefined, user?.username);
      toast.push('success', 'Code sync started / completed.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Code sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load();
  }

  const rows = tab === 'standard' ? standard : classification;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ZRA Codes</h1>
          <p className="text-sm text-gray-500">Sync and browse standard / classification codes from VSDC.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-end gap-2">
            <Field label="Store ID" className="w-28">
              <input
                className="input"
                type="number"
                min={1}
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              />
            </Field>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSync}
              disabled={!canFinance || syncing}
            >
              {syncing ? <Spinner className="h-4 w-4" /> : 'Sync codes'}
            </button>
          </div>
          {!canFinance && <p className="text-xs text-gray-500">Finance admin only</p>}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <Card>
        <div className="border-b border-gray-200">
          <div className="flex gap-1">
            {(
              [
                { id: 'standard' as const, label: 'Standard' },
                { id: 'classification' as const, label: 'Classification' }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(0);
                }}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'border-brand-green text-brand-green-dark'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Search" className="min-w-[200px] flex-1">
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'standard' ? 'Code or name…' : 'Class code or name…'}
            />
          </Field>
          {tab === 'standard' && (
            <Field label="cdCls" className="w-36">
              <input
                className="input font-mono"
                value={cdCls}
                onChange={(e) => setCdCls(e.target.value)}
                placeholder="e.g. 04"
              />
            </Field>
          )}
          <button type="submit" className="btn-ghost" disabled={loading}>
            Search
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-gray-100 px-5 py-3">
          <SectionTitle>Results</SectionTitle>
        </div>
        {loading && rows == null ? (
          <div className="p-6">
            <Loading label="Loading codes…" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <EmptyState>No codes found.</EmptyState>
        ) : tab === 'standard' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">cdCls</th>
                  <th className="px-4 py-3 font-medium">cd</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Use</th>
                </tr>
              </thead>
              <tbody>
                {(standard ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.cdCls}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.cd}</td>
                    <td className="px-4 py-3">{r.cdNm}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500" title={r.cdDesc}>
                      {r.cdDesc ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.useYn ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">itemClsCd</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">taxTyCd</th>
                  <th className="px-4 py-3 font-medium">Use</th>
                </tr>
              </thead>
              <tbody>
                {(classification ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.itemClsCd}</td>
                    <td className="px-4 py-3">{r.itemClsNm}</td>
                    <td className="px-4 py-3">{r.itemClsLvl ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.taxTyCd ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{r.useYn ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
          <span>Page {page + 1}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={loading || !rows || rows.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
