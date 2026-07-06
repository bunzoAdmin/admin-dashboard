'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type OrderResponse,
  type PagedOrderResponse
} from '@/lib/orderAdminTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, Spinner, money } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

function orderStatusTone(status: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'DELIVERED': return 'green';
    case 'CONFIRMED':
    case 'PACKING':
    case 'READY_FOR_DELIVERY':
    case 'OUT_FOR_DELIVERY': return 'blue';
    case 'PENDING_PAYMENT': return 'amber';
    case 'CANCELLED': return 'red';
    default: return 'gray';
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function OrdersListPage() {
  const router = useRouter();
  const { storeId, setStoreId } = useStoreContext();
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<PagedOrderResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sid: number, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await orderAdminApi.listOrders({
        storeId: sid,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        customerPhone: customerPhone.trim() || undefined,
        orderNumber: orderNumber.trim() || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
        page: pg,
        size: 20
      });
      setData(result);
    } catch (err) {
      setError(err instanceof OrderAdminApiError ? err.message : 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [status, paymentStatus, customerPhone, orderNumber, dateFrom, dateTo]);

  useEffect(() => {
    setPage(0);
    load(storeId, 0);
  }, [storeId, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load(storeId, 0);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    load(storeId, newPage);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500">Search and manage orders across the store.</p>
      </div>

      <form onSubmit={handleSearch}>
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
            <label className="block space-y-1.5">
              <span className="label">Order Status</span>
              <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                {ORDER_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Payment Status</span>
              <select className="input w-full" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                {PAYMENT_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Customer phone</span>
              <input type="tel" className="input w-full" placeholder="+260…" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Order number</span>
              <input type="text" className="input w-full font-mono" placeholder="ORD…" value={orderNumber} onChange={e => setOrderNumber(e.target.value.toUpperCase())} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">From</span>
              <input type="datetime-local" className="input w-full" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">To</span>
              <input type="datetime-local" className="input w-full" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4 mx-auto" /> : 'Search'}
              </button>
            </div>
          </div>
        </Card>
      </form>

      {error && <ErrorBox message={error} />}

      {loading && !data && <Loading label="Loading orders…" />}

      {data && (
        <Card className="overflow-hidden p-0 relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          {data.content.length === 0 ? (
            <EmptyState>No orders found for the selected filters.</EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 font-medium">Order #</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((order: OrderResponse) => (
                      <tr
                        key={order.orderNumber}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/orders/${order.orderNumber}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate" title={order.customerId}>{order.customerId}</td>
                        <td className="px-4 py-3">
                          <Badge tone={orderStatusTone(order.status)}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {order.paymentMethod} &middot; {order.paymentStatus.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 font-medium">{money(order.grandTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(order.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/orders/${order.orderNumber}`} className="btn-ghost px-2 py-1 text-xs" onClick={e => e.stopPropagation()}>
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <span className="text-xs text-gray-500">
                    Page {data.meta.page + 1} of {data.meta.totalPages} &middot; {data.meta.totalElements} orders
                  </span>
                  <div className="flex gap-2">
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={data.meta.first || loading} onClick={() => handlePageChange(page - 1)}>
                      Prev
                    </button>
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={data.meta.last || loading} onClick={() => handlePageChange(page + 1)}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
