'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import type { DiscrepancyDetailResponse } from '@/lib/inventoryHealthTypes';
import { pickerApi } from '@/lib/pickerApi';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { formatStoreDateTimeShort } from '@/lib/storeTime';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

function fmtDate(iso?: string | null) {
  return formatStoreDateTimeShort(iso);
}

function reasonLabel(reason?: string | null): string {
  switch (reason) {
    case 'SHORT_PICK':
      return 'Short pick';
    case 'ITEM_UNAVAILABLE':
      return 'Item unavailable';
    default:
      return reason || '—';
  }
}

function reasonTone(reason?: string | null): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  if (reason === 'ITEM_UNAVAILABLE') return 'red';
  if (reason === 'SHORT_PICK') return 'amber';
  return 'gray';
}

function parsePickerId(reportedBy?: string | null): number | null {
  if (!reportedBy) return null;
  const n = Number(reportedBy);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function DiscrepanciesPage() {
  const toast = useToast();
  const { storeId, setStoreId } = useStoreContext();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [rows, setRows] = useState<DiscrepancyDetailResponse[] | null>(null);
  const [pickerNames, setPickerNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolvedByInput, setResolvedByInput] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const load = useCallback(async (sid: number | null, st: string) => {
    if (sid == null) return;
    setLoading(true);
    setError(null);
    try {
      const [discrepancies, pickers] = await Promise.all([
        inventoryHealthApi.listDiscrepancies(sid, { status: st || undefined, size: 100 }),
        pickerApi.listPickers(sid, { includeOffboarded: true, size: 200 }).catch(() => [])
      ]);
      setRows(discrepancies);

      const nameMap: Record<number, string> = {};
      for (const p of pickers) {
        nameMap[p.id] = p.name;
      }

      // Fill any reportedBy ids missing from the store roster (e.g. moved stores).
      const missingIds = Array.from(
        new Set(
          discrepancies
            .map((d) => parsePickerId(d.reportedBy))
            .filter((id): id is number => id != null && !nameMap[id])
        )
      );
      if (missingIds.length > 0) {
        await Promise.all(
          missingIds.map(async (id) => {
            try {
              const p = await pickerApi.getPicker(id);
              nameMap[id] = p.name;
            } catch {
              // keep id-only display
            }
          })
        );
      }
      setPickerNames(nameMap);
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load discrepancies.');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(storeId, statusFilter);
  }, [storeId, statusFilter, load]);

  const pickerLabel = useCallback(
    (reportedBy?: string | null) => {
      const id = parsePickerId(reportedBy);
      if (id == null) {
        return reportedBy ? { name: reportedBy, id: null as number | null } : { name: null, id: null };
      }
      return { name: pickerNames[id] ?? null, id };
    },
    [pickerNames]
  );

  async function handleResolve(id: number) {
    const resolvedBy = resolvedByInput.trim() || 'ADMIN';
    setResolving(id);
    try {
      const updated = await inventoryHealthApi.resolveDiscrepancy(id, resolvedBy);
      setRows((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
      toast.push('success', 'Discrepancy resolved.');
      setResolvingId(null);
      setResolvedByInput('');
    } catch (err) {
      toast.push('error', err instanceof InventoryHealthApiError ? err.message : 'Resolve failed.');
    } finally {
      setResolving(null);
    }
  }

  const openCount = useMemo(
    () => rows?.filter((r) => r.status === 'OPEN').length ?? 0,
    [rows]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stock Discrepancies</h1>
        <p className="text-sm text-gray-500">
          SKU-level shelf mismatches from short picks / unavailable items. Resolve after you fix stock.
          For order, refund, and full pick context use{' '}
          <Link href="/pickers/short-picks" className="text-blue-600 hover:underline">
            Short Picks
          </Link>
          .
        </p>
        {rows && (
          <p className="mt-1 text-xs text-gray-400">
            Showing {rows.length} row{rows.length === 1 ? '' : 's'}
            {statusFilter === 'OPEN' || !statusFilter ? ` · ${openCount} open` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
        <label className="block space-y-1.5">
          <span className="label">Status</span>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </label>
      </div>

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {storeId == null ? (
          <EmptyState>Select a store above to view discrepancies.</EmptyState>
        ) : loading && rows === null ? (
          <div className="p-6">
            <Loading label="Loading discrepancies…" />
          </div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No discrepancies for the selected filters.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Found</th>
                  <th className="px-4 py-3 font-medium">Diff</th>
                  <th className="px-4 py-3 font-medium">Auto-zeroed</th>
                  <th className="px-4 py-3 font-medium">Reports</th>
                  <th className="px-4 py-3 font-medium">Picker</th>
                  <th className="px-4 py-3 font-medium">Pick task</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const picker = pickerLabel(r.reportedBy);
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-gray-50 last:border-0 align-top">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-medium text-gray-900">{r.sku}</div>
                          <div className="mt-0.5 text-[11px] text-gray-400">#{r.id}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {r.locationCode || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={reasonTone(r.reason)}>{reasonLabel(r.reason)}</Badge>
                        </td>
                        <td className="px-4 py-3">{r.expectedQty ?? '—'}</td>
                        <td className="px-4 py-3">{r.foundQty ?? '—'}</td>
                        <td className="px-4 py-3">
                          {r.discrepancyQty == null ? (
                            '—'
                          ) : (
                            <Badge tone={r.discrepancyQty > 0 ? 'red' : 'amber'}>
                              {r.discrepancyQty > 0 ? `-${r.discrepancyQty}` : r.discrepancyQty}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.autoZeroed ? (
                            <Badge tone="red">Yes</Badge>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.reportCount ?? 1}</td>
                        <td className="px-4 py-3">
                          {picker.id != null ? (
                            <div>
                              <Link
                                href={`/pickers/${picker.id}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {picker.name || `Picker #${picker.id}`}
                              </Link>
                              <div className="text-[11px] text-gray-400">Picker id {picker.id}</div>
                            </div>
                          ) : picker.name ? (
                            <span className="text-gray-700">{picker.name}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.pickTaskId != null ? (
                            <div className="space-y-0.5">
                              <Link
                                href={`/pickers/tasks/${r.pickTaskId}`}
                                className="font-mono text-xs text-blue-600 hover:underline"
                              >
                                Task #{r.pickTaskId}
                              </Link>
                              <div>
                                <Link
                                  href="/pickers/short-picks"
                                  className="text-[11px] text-gray-500 hover:underline"
                                >
                                  Short picks →
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={r.status === 'OPEN' ? 'amber' : 'green'}>{r.status}</Badge>
                          {r.resolvedBy && (
                            <div className="mt-1 text-[11px] text-gray-400">by {r.resolvedBy}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(r.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {r.status === 'OPEN' && (
                            <button
                              type="button"
                              className="btn-ghost px-2 py-1 text-xs"
                              onClick={() => setResolvingId(resolvingId === r.id ? null : r.id)}
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                      {resolvingId === r.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={13} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                className="input w-48"
                                placeholder="Resolved by (name / ID)"
                                value={resolvedByInput}
                                onChange={(e) => setResolvedByInput(e.target.value)}
                              />
                              <button
                                className="btn-primary text-sm"
                                disabled={resolving === r.id}
                                onClick={() => handleResolve(r.id)}
                              >
                                {resolving === r.id ? <Spinner className="h-4 w-4" /> : 'Confirm Resolve'}
                              </button>
                              <button className="btn-ghost text-sm" onClick={() => setResolvingId(null)}>
                                Cancel
                              </button>
                              {r.orderUuid && (
                                <span className="text-xs text-gray-500">
                                  Order UUID: <span className="font-mono">{r.orderUuid}</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
