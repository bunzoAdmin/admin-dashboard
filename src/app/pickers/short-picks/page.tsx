'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, X } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type {
  ShortPickDetailResponse,
  ShortPickListEntryResponse,
  ShortPickPageResponse,
  ShortPickType
} from '@/lib/pickerTypes';
import { SHORT_PICK_TYPE_OPTIONS } from '@/lib/pickerTypes';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Badge, Card, EmptyState, ErrorBox, Loading, SectionTitle, money } from '@/components/ui';
import {
  addStoreCalendarDays,
  formatStoreDateTimeShort,
  storeDayStartInstant,
  todayIsoStore
} from '@/lib/storeTime';

type DatePreset = 'today' | 'last7' | 'last30' | 'all';

const OUTCOME_TONE: Record<string, 'gray' | 'green' | 'amber' | 'red' | 'blue'> = {
  PARTIAL_SHORT: 'amber',
  ITEM_UNAVAILABLE: 'red',
  ALL_UNAVAILABLE_CANCEL: 'red',
  PREPAID_BLOCKED_CANCEL: 'red',
  FULLY_PICKED: 'green',
  PENDING: 'gray'
};

const OUTCOME_LABEL: Record<string, string> = {
  PARTIAL_SHORT: 'Partial short',
  ITEM_UNAVAILABLE: 'Unavailable',
  ALL_UNAVAILABLE_CANCEL: 'All unavailable cancel',
  PREPAID_BLOCKED_CANCEL: 'Prepaid blocked cancel',
  FULLY_PICKED: 'Fully picked',
  PENDING: 'Pending'
};

function resolveRange(preset: DatePreset): { from?: string; toExclusive?: string } {
  if (preset === 'all') return {};
  const today = todayIsoStore();
  const toExclusive = new Date().toISOString();
  if (preset === 'today') {
    return { from: storeDayStartInstant(today), toExclusive };
  }
  const days = preset === 'last7' ? -6 : -29;
  return { from: storeDayStartInstant(addStoreCalendarDays(today, days)), toExclusive };
}

function outcomeLabel(code?: string | null): string {
  if (!code) return '—';
  return OUTCOME_LABEL[code] ?? code;
}

export default function ShortPicksPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [preset, setPreset] = useState<DatePreset>('last7');
  const [type, setType] = useState<ShortPickType | ''>('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ShortPickPageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ShortPickDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedTaskIdRef = useRef<number | null>(null);

  useEffect(() => {
    setPage(0);
  }, [storeId, preset, type]);

  useEffect(() => {
    if (storeId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const range = resolveRange(preset);
    pickerApi
      .listShortPicks(storeId, {
        type,
        from: range.from,
        toExclusive: range.toExclusive,
        page,
        size: 20
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof PickerApiError ? err.message : 'Failed to load short picks.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, preset, type, page, refreshKey]);

  const load = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const openDetail = async (taskId: number) => {
    selectedTaskIdRef.current = taskId;
    setSelectedTaskId(taskId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const result = await pickerApi.getShortPickDetail(taskId);
      if (selectedTaskIdRef.current !== taskId) return;
      setDetail(result);
    } catch (err) {
      if (selectedTaskIdRef.current !== taskId) return;
      setDetailError(err instanceof PickerApiError ? err.message : 'Failed to load detail.');
    } finally {
      if (selectedTaskIdRef.current === taskId) {
        setDetailLoading(false);
      }
    }
  };

  const closeDetail = () => {
    selectedTaskIdRef.current = null;
    setSelectedTaskId(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Short picks &amp; picker cancels</h1>
          <p className="text-sm text-gray-500">
            Partial shorts, unavailable items, and orders cancelled through the picker — with stock and refund detail.
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
        <label className="block space-y-1.5">
          <span className="label">Outcome</span>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as ShortPickType | '')}
          >
            {SHORT_PICK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="label">Period</span>
          <select
            className="input"
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
          >
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </Card>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view short picks.</EmptyState>
      ) : loading && data === null ? (
        <Loading label="Loading short picks…" />
      ) : data && data.items.length === 0 ? (
        <EmptyState>No short picks or picker cancels for this filter.</EmptyState>
      ) : data ? (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Picker</th>
                    <th className="px-4 py-3">Money</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((row) => (
                    <ShortPickRow
                      key={row.taskId}
                      row={row}
                      selected={selectedTaskId === row.taskId}
                      onOpen={() => openDetail(row.taskId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {data.total} result{data.total === 1 ? '' : 's'} · page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={page <= 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      {selectedTaskId != null && (
        <DetailPanel
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

function ShortPickRow({
  row,
  selected,
  onOpen
}: {
  row: ShortPickListEntryResponse;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <tr className={selected ? 'bg-blue-50/60' : 'hover:bg-gray-50'}>
      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
        {row.occurredAt ? formatStoreDateTimeShort(row.occurredAt) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs">
          {row.orderNumber ? (
            <Link
              href={`/orders/${encodeURIComponent(row.orderNumber)}`}
              className="text-blue-600 hover:underline"
            >
              {row.orderNumber}
            </Link>
          ) : (
            <span className="text-gray-400">{row.orderUuid.slice(0, 8)}…</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-gray-500">
          Task #{row.taskId} · {row.taskStatus}
          {row.orderStatus ? ` · order ${row.orderStatus}` : ''}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge tone={OUTCOME_TONE[row.primaryOutcome] ?? 'amber'}>
            {outcomeLabel(row.primaryOutcome)}
          </Badge>
          {row.outcomes
            .filter((o) => o !== row.primaryOutcome)
            .map((o) => (
              <Badge key={o} tone={OUTCOME_TONE[o] ?? 'gray'}>
                {outcomeLabel(o)}
              </Badge>
            ))}
        </div>
        {row.cancelledReason && (
          <div className="mt-1 text-xs text-gray-500">{row.cancelledReason}</div>
        )}
      </td>
      <td className="px-4 py-3 text-gray-700">
        <div>
          {row.shortedItemCount}/{row.totalItemCount} affected
        </div>
        <div className="text-xs text-gray-500">
          {row.partialShortItemCount} short · {row.unavailableItemCount} unavailable
        </div>
      </td>
      <td className="px-4 py-3">
        {row.pickerId != null ? (
          <Link href={`/pickers/${row.pickerId}`} className="text-blue-600 hover:underline">
            {row.pickerName || `Picker #${row.pickerId}`}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-gray-700">
        <div>{money(row.orderGrandTotal)}</div>
        {(row.refundedAmount ?? 0) > 0 && (
          <div className="text-xs text-amber-700">Refunded {money(row.refundedAmount)}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" className="btn-ghost text-sm" onClick={onOpen}>
          Details
        </button>
      </td>
    </tr>
  );
}

function DetailPanel({
  detail,
  loading,
  error,
  onClose
}: {
  detail: ShortPickDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {detail ? `Task #${detail.taskId}` : 'Short pick detail'}
          </h2>
          {detail?.orderNumber && (
            <p className="text-sm text-gray-500">
              Order{' '}
              <Link
                href={`/orders/${encodeURIComponent(detail.orderNumber)}`}
                className="font-mono text-blue-600 hover:underline"
              >
                {detail.orderNumber}
              </Link>
            </p>
          )}
        </div>
        <button type="button" className="btn-ghost p-2" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {loading && <Loading label="Loading detail…" />}
        {error && <ErrorBox message={error} />}

        {detail && !loading && (
          <>
            <div className="flex flex-wrap gap-1">
              {detail.outcomes.map((o) => (
                <Badge key={o} tone={OUTCOME_TONE[o] ?? 'amber'}>
                  {outcomeLabel(o)}
                </Badge>
              ))}
            </div>

            <Card>
              <SectionTitle>Summary</SectionTitle>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Picker</dt>
                <dd>
                  {detail.pickerId != null ? (
                    <Link href={`/pickers/${detail.pickerId}`} className="text-blue-600 hover:underline">
                      {detail.pickerName || `#${detail.pickerId}`}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt className="text-gray-500">Task status</dt>
                <dd>{detail.taskStatus}</dd>
                <dt className="text-gray-500">Order status</dt>
                <dd>{detail.orderStatus ?? '—'}</dd>
                <dt className="text-gray-500">Payment</dt>
                <dd>
                  {detail.paymentMethod ?? '—'}
                  {detail.paymentStatus ? ` · ${detail.paymentStatus}` : ''}
                </dd>
                <dt className="text-gray-500">Cancel reason</dt>
                <dd>{detail.cancelledReason ?? '—'}</dd>
                <dt className="text-gray-500">Completed</dt>
                <dd>
                  {detail.taskCompletedAt
                    ? formatStoreDateTimeShort(detail.taskCompletedAt)
                    : '—'}
                </dd>
                <dt className="text-gray-500">Grand total</dt>
                <dd>{money(detail.orderGrandTotal)}</dd>
                <dt className="text-gray-500">Paid</dt>
                <dd>{money(detail.paidAmount)}</dd>
                <dt className="text-gray-500">Discount</dt>
                <dd>{money(detail.discountAmount)}</dd>
              </dl>
              <div className="mt-3">
                <Link
                  href={`/pickers/tasks/${detail.taskId}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open pick task →
                </Link>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-gray-100 px-4 py-3">
                <SectionTitle>Items</SectionTitle>
              </div>
              <div className="divide-y divide-gray-100">
                {detail.items.map((item) => (
                  <div key={item.pickItemId} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{item.productName}</div>
                        <div className="font-mono text-xs text-gray-500">
                          {item.sku}
                          {item.locationCode ? ` · ${item.locationCode}` : ''}
                        </div>
                      </div>
                      <Badge tone={OUTCOME_TONE[item.lineOutcome] ?? 'gray'}>
                        {outcomeLabel(item.lineOutcome)}
                      </Badge>
                    </div>
                    <div className="text-gray-700">
                      Ordered {item.orderedQuantity} · picked {item.pickedQuantity}
                      {item.fulfilledQuantity != null ? ` · fulfilled ${item.fulfilledQuantity}` : ''}
                      {item.unitPrice != null ? ` · ${money(item.unitPrice)} each` : ''}
                    </div>
                    {item.stockOutcome && (
                      <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        Stock: {item.stockOutcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {detail.stockOutcomeNotes.length > 0 && (
              <Card>
                <SectionTitle>Stock notes</SectionTitle>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {detail.stockOutcomeNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </Card>
            )}

            {detail.discrepancies.length > 0 && (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-gray-100 px-4 py-3">
                  <SectionTitle>Discrepancies</SectionTitle>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">SKU</th>
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2">Expected / found</th>
                      <th className="px-4 py-2">Reason</th>
                      <th className="px-4 py-2">Auto-zero</th>
                      <th className="px-4 py-2">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.discrepancies.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2 font-mono text-xs">{d.sku}</td>
                        <td className="px-4 py-2 font-mono text-xs">{d.locationCode ?? '—'}</td>
                        <td className="px-4 py-2">
                          {d.expectedQty} / {d.foundQty}
                        </td>
                        <td className="px-4 py-2">{d.reason}</td>
                        <td className="px-4 py-2">
                          {d.autoZeroed ? (
                            <Badge tone="red">Yes</Badge>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2">{d.reportCount ?? 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {detail.cancellationReturns.length > 0 && (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-gray-100 px-4 py-3">
                  <SectionTitle>Stock returned on cancel</SectionTitle>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">SKU</th>
                      <th className="px-4 py-2">Qty</th>
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.cancellationReturns.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 font-mono text-xs">{r.sku ?? '—'}</td>
                        <td className="px-4 py-2">{r.quantity}</td>
                        <td className="px-4 py-2">{r.locationCode ?? '—'}</td>
                        <td className="px-4 py-2">{r.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {detail.refunds.length > 0 && (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-gray-100 px-4 py-3">
                  <SectionTitle>Refunds</SectionTitle>
                </div>
                <div className="divide-y divide-gray-100">
                  {detail.refunds.map((r) => (
                    <div key={r.refundId} className="px-4 py-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{money(r.amount)}</span>
                        <Badge
                          tone={
                            r.status === 'ACCEPTED' || r.status === 'COMPLETED'
                              ? 'green'
                              : r.status === 'FAILED'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {r.status ?? '—'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {r.reason ?? '—'}
                        {r.createdAt ? ` · ${formatStoreDateTimeShort(r.createdAt)}` : ''}
                      </div>
                      {r.failureReason && (
                        <div className="mt-1 text-xs text-red-600">{r.failureReason}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {detail.events.length > 0 && (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-gray-100 px-4 py-3">
                  <SectionTitle>Related events</SectionTitle>
                </div>
                <div className="divide-y divide-gray-100">
                  {detail.events.map((e, idx) => (
                    <div key={`${e.eventType}-${idx}`} className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{e.eventType}</div>
                      <div className="text-xs text-gray-500">
                        {e.actorId ?? '—'}
                        {e.createdAt ? ` · ${formatStoreDateTimeShort(e.createdAt)}` : ''}
                      </div>
                      {e.notes && <div className="mt-1 text-xs text-gray-700">{e.notes}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
