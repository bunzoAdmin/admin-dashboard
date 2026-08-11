'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  formatDate
} from '@/components/ui';
import { zraApi, ZraApiError, type ZraAuditLog } from '@/lib/zraApi';
import {
  useZraStore,
  ZraStoreSelector,
  ZRA_ALL_STORES_SCOPE
} from '@/components/zra/ZraStoreSelector';

export default function ZraAuditPage() {
  const { storeId, storeIdParam } = useZraStore();
  const [filterScope, setFilterScope] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [appliedStoreId, setAppliedStoreId] = useState('');
  const [appliedScope, setAppliedScope] = useState<string | null>(null);
  const [appliedAction, setAppliedAction] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ZraAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sid = Number(appliedStoreId);
    const resolvedStoreId =
      appliedScope === ZRA_ALL_STORES_SCOPE
        ? undefined
        : Number.isFinite(sid) && sid > 0
          ? sid
          : storeIdParam;
    try {
      const result = await zraApi.listAudit({
        storeId: resolvedStoreId,
        action: appliedAction.trim() || undefined,
        page,
        size: 50
      });
      setRows(result.content ?? []);
      setTotal(result.totalElements ?? 0);
      setTotalPages(result.totalPages ?? 0);
    } catch (err) {
      setError(err instanceof ZraApiError ? err.message : 'Failed to load audit log.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedStoreId, appliedScope, appliedAction, page, storeIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedStoreId(storeId != null ? String(storeId) : '');
    setAppliedScope(filterScope);
    setAppliedAction(action);
    setPage(0);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ZRA Audit trail</h1>
        <p className="text-sm text-gray-500">
          Irreversible finance actions: purchases, credit notes, stock sync, code sync, mapping changes.
        </p>
      </div>

      <form onSubmit={handleSearch}>
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ZraStoreSelector
              allowAll
              scope={filterScope}
              onScopeChange={setFilterScope}
            />
            <Field label="Action (optional)">
              <input
                className="input font-mono"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="CREDIT_NOTE_ISSUE"
              />
            </Field>
            <div className="flex items-end">
              <button type="submit" className="btn-primary">
                Search
              </button>
            </div>
          </div>
        </Card>
      </form>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading label="Loading audit log…" />
      ) : rows.length === 0 ? (
        <EmptyState>No matching ZRA admin actions.</EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      {r.createdAt ? formatDate(r.createdAt) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.adminUser ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.action ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.entityType ?? '—'}
                      {r.entityId ? ` / ${r.entityId}` : ''}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.storeId ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 break-all max-w-md">
                      {r.detailJson ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            <span>
              {total} row(s) · page {page + 1}/{Math.max(totalPages, 1)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
