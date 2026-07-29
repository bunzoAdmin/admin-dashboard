'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import {
  INVOICE_BACKLOG_STATUS_OPTIONS,
  type AdminOrderListItem,
  type InvoiceInfo,
  type PagedAdminOrderResponse
} from '@/lib/orderAdminTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, money } from '@/components/ui';
import { InvoiceOpsPanel } from '@/components/orders/InvoiceOpsPanel';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import {
  addStoreCalendarDays,
  formatStoreDateTimeShort,
  parseStoreDatetimeLocal,
  storeDayStartInstant,
  todayIsoStore
} from '@/lib/storeTime';

type DatePreset = 'today' | 'last7' | 'custom';

function invoiceStatusTone(status?: string | null): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'ISSUED': return 'green';
    case 'FAILED': return 'red';
    case 'PENDING': return 'amber';
    case 'SKIPPED': return 'gray';
    default: return 'blue';
  }
}

function resolveDateRange(preset: DatePreset, dateFrom: string, dateTo: string): { dateFrom?: string; dateTo?: string } {
  const today = todayIsoStore();
  if (preset === 'today') {
    return {
      dateFrom: storeDayStartInstant(today),
      dateTo: new Date(`${addStoreCalendarDays(today, 1)}T00:00:00+02:00`).toISOString()
    };
  }
  if (preset === 'last7') {
    return {
      dateFrom: storeDayStartInstant(addStoreCalendarDays(today, -6)),
      dateTo: new Date().toISOString()
    };
  }
  return {
    dateFrom: dateFrom ? parseStoreDatetimeLocal(dateFrom) : undefined,
    dateTo: dateTo ? parseStoreDatetimeLocal(dateTo) : undefined
  };
}

export default function InvoiceBacklogPage() {
  const { storeId, setStoreId } = useStoreContext();
  const [preset, setPreset] = useState<DatePreset>('last7');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<PagedAdminOrderResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceOverrides, setInvoiceOverrides] = useState<Record<string, InvoiceInfo>>({});

  const load = useCallback(async (sid: number | null, pg: number) => {
    if (sid == null) return;
    setLoading(true);
    setError(null);
    const range = resolveDateRange(preset, dateFrom, dateTo);
    try {
      const result = await orderAdminApi.listInvoiceBacklog({
        storeId: sid,
        invoiceStatus: invoiceStatus || undefined,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        page: pg,
        size: 20
      });
      setData(result);
      setInvoiceOverrides({});
    } catch (err) {
      setError(err instanceof OrderAdminApiError ? err.message : 'Failed to load invoice backlog.');
    } finally {
      setLoading(false);
    }
  }, [preset, invoiceStatus, dateFrom, dateTo]);

  useEffect(() => {
    setPage(0);
    load(storeId, 0);
  }, [storeId, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load(storeId, 0);
  }

  function handleInvoiceUpdated(orderNumber: string, invoice: InvoiceInfo) {
    setInvoiceOverrides(prev => ({ ...prev, [orderNumber]: invoice }));
    if (invoice.available) {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          content: prev.content.filter(row => row.orderNumber !== orderNumber),
          meta: {
            ...prev.meta,
            totalElements: Math.max(0, prev.meta.totalElements - 1)
          }
        };
      });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Missing Invoices</h1>
        <p className="text-sm text-gray-500">
          Delivered orders without an issued invoice — upload a PDF manually or retry ZRA auto-issue.
        </p>
      </div>

      <form onSubmit={handleSearch}>
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
            <label className="block space-y-1.5">
              <span className="label">Invoice status</span>
              <select className="input w-full" value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)}>
                {INVOICE_BACKLOG_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Date range</span>
              <select
                className="input w-full"
                value={preset}
                onChange={e => setPreset(e.target.value as DatePreset)}
              >
                <option value="today">Today (CAT)</option>
                <option value="last7">Last 7 days</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {preset === 'custom' && (
              <>
                <label className="block space-y-1.5">
                  <span className="label">From (CAT)</span>
                  <input type="datetime-local" className="input w-full" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="label">To (CAT)</span>
                  <input type="datetime-local" className="input w-full" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </label>
              </>
            )}
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4 mx-auto" /> : 'Search'}
              </button>
            </div>
          </div>
        </Card>
      </form>

      {error && <ErrorBox message={error} />}

      {storeId == null ? (
        <EmptyState>Select a store to view orders missing invoices.</EmptyState>
      ) : (
        <>
          {loading && !data && <Loading label="Loading backlog…" />}

          {data && (
            <Card className="overflow-hidden p-0 relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                  <Spinner className="h-6 w-6" />
                </div>
              )}
              {data.content.length === 0 ? (
                <EmptyState>No delivered orders missing invoices for these filters.</EmptyState>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3 font-medium">Order #</th>
                          <th className="px-4 py-3 font-medium">Delivered</th>
                          <th className="px-4 py-3 font-medium">Invoice</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.content.map((order: AdminOrderListItem) => {
                          const invoice = invoiceOverrides[order.orderNumber] ?? order.invoice;
                          const invStatus = invoice?.status ?? 'MISSING';
                          return (
                            <tr key={order.orderNumber} className="border-b border-gray-50 last:border-0 align-top">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/orders/${order.orderNumber}`}
                                  className="font-mono text-xs font-medium text-blue-600 hover:underline"
                                >
                                  {order.orderNumber}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {formatStoreDateTimeShort(order.updatedAt)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={invoiceStatusTone(invoice?.status)}>{invStatus}</Badge>
                                {invoice?.lastError && (
                                  <p className="mt-1 max-w-xs text-xs text-red-600 break-words">{invoice.lastError}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium">{money(order.grandTotal)}</td>
                              <td className="px-4 py-3 min-w-[220px]">
                                <InvoiceOpsPanel
                                  compact
                                  orderNumber={order.orderNumber}
                                  invoice={invoice}
                                  onUpdated={(info) => handleInvoiceUpdated(order.orderNumber, info)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {data.meta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                      <span className="text-xs text-gray-500">
                        Page {data.meta.page + 1} of {data.meta.totalPages} · {data.meta.totalElements} orders
                      </span>
                      <div className="flex gap-2">
                        <button
                          className="btn-ghost px-3 py-1 text-xs"
                          disabled={data.meta.first || loading}
                          onClick={() => { setPage(page - 1); load(storeId, page - 1); }}
                        >
                          Prev
                        </button>
                        <button
                          className="btn-ghost px-3 py-1 text-xs"
                          disabled={data.meta.last || loading}
                          onClick={() => { setPage(page + 1); load(storeId, page + 1); }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
