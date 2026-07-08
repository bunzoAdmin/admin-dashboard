'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { OrderEventResponse, OrderResponse } from '@/lib/orderAdminTypes';
import { Badge, Card, ErrorBox, Loading, Spinner, SectionTitle, money, useToast } from '@/components/ui';
import { PickerOpsCard } from '@/components/pickers/PickerOpsCard';
import { ArrowLeft } from 'lucide-react';

function orderStatusTone(status: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'DELIVERED': return 'green';
    case 'CONFIRMED': case 'PACKING': case 'READY_FOR_DELIVERY': case 'OUT_FOR_DELIVERY': return 'blue';
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

const CANCELLABLE = ['PENDING_PAYMENT', 'CONFIRMED', 'PACKING', 'READY_FOR_DELIVERY'];

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const router = useRouter();
  const toast = useToast();

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [events, setEvents] = useState<OrderEventResponse[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoadingOrder(true);
    setError(null);
    try {
      setOrder(await orderAdminApi.getOrder(orderNumber));
    } catch (err) {
      setError(err instanceof OrderAdminApiError ? err.message : 'Failed to load order.');
    } finally {
      setLoadingOrder(false);
    }
  }, [orderNumber]);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      setEvents(await orderAdminApi.getOrderEvents(orderNumber));
    } catch {
      // non-fatal; events are audit trail
    } finally {
      setLoadingEvents(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    loadOrder();
    loadEvents();
  }, [loadOrder, loadEvents]);

  async function handleCancel() {
    if (!cancelReason.trim()) {
      toast.push('error', 'Please enter a cancellation reason.');
      return;
    }
    setCancelling(true);
    try {
      const updated = await orderAdminApi.cancelOrder(orderNumber, { reason: cancelReason });
      setOrder(updated);
      await loadEvents();
      toast.push('success', 'Order cancelled.');
      setShowCancelForm(false);
      setCancelReason('');
    } catch (err) {
      toast.push('error', err instanceof OrderAdminApiError ? err.message : 'Cancel failed.');
    } finally {
      setCancelling(false);
    }
  }

  if (loadingOrder) {
    return <div className="p-6"><Loading label="Loading order…" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <ErrorBox message={error} />
      </div>
    );
  }

  if (!order) return null;

  const canCancel = CANCELLABLE.includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Order {order.orderNumber}</h1>
          <p className="text-xs text-gray-500">Customer: {order.customerId} &middot; Created: {fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {canCancel && (
            <button className="btn-danger text-sm" onClick={() => setShowCancelForm(v => !v)}>
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {showCancelForm && (
        <Card>
          <SectionTitle>Cancel Order</SectionTitle>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="label">Reason</span>
              <input
                className="input w-full"
                placeholder="Enter cancellation reason…"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button className="btn-danger text-sm" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? <Spinner className="h-4 w-4" /> : 'Confirm Cancel'}
              </button>
              <button className="btn-ghost text-sm" onClick={() => setShowCancelForm(false)}>Dismiss</button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle>Order Summary</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-gray-500">Status</div>
              <div><Badge tone={orderStatusTone(order.status)}>{order.status.replace(/_/g, ' ')}</Badge></div>
              <div className="text-gray-500">Payment</div>
              <div>{order.paymentMethod} &middot; <span className="text-xs text-gray-500">{order.paymentStatus.replace(/_/g, ' ')}</span></div>
              {order.paymentPhone && <><div className="text-gray-500">Pay phone</div><div className="font-mono text-xs">{order.paymentPhone}</div></>}
              <div className="text-gray-500">Items total</div><div>{money(order.itemsTotal)}</div>
              {(order.discountAmount ?? 0) > 0 && <><div className="text-gray-500">Discount</div><div className="text-green-600">-{money(order.discountAmount ?? 0)}</div></>}
              <div className="text-gray-500">Delivery fee</div><div>{money(order.deliveryFee)}</div>
              {(order.handlingFee ?? 0) > 0 && <><div className="text-gray-500">Handling</div><div>{money(order.handlingFee ?? 0)}</div></>}
              <div className="font-semibold text-gray-700">Grand total</div><div className="font-bold">{money(order.grandTotal)}</div>
              {order.deliveryZone && <><div className="text-gray-500">Delivery zone</div><div>{order.deliveryZone}</div></>}
              {order.cancelledReason && <><div className="text-gray-500">Cancel reason</div><div className="text-red-600">{order.cancelledReasonDisplay || order.cancelledReason}</div></>}
            </div>
          </Card>

          <Card>
            <SectionTitle>Items</SectionTitle>
            <div className="divide-y divide-gray-50">
              {order.items?.map(item => (
                <div key={item.sku} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{item.orderedQuantity} × {money(item.unitPrice)}</p>
                    {item.fulfilledQuantity != null && item.fulfilledQuantity !== item.orderedQuantity && (
                      <p className="text-xs text-amber-600">Fulfilled: {item.fulfilledQuantity}</p>
                    )}
                    <p className="font-medium">{money(item.subTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {order.delivery && (
            <Card>
              <SectionTitle>Delivery</SectionTitle>
              <div className="space-y-1 text-sm">
                {order.delivery.recipientName && <p><span className="text-gray-500">Recipient:</span> {order.delivery.recipientName}</p>}
                <p><span className="text-gray-500">Phone:</span> {order.delivery.phone}</p>
                <p><span className="text-gray-500">Address:</span> {order.delivery.address}</p>
                {order.delivery.notes && <p><span className="text-gray-500">Notes:</span> {order.delivery.notes}</p>}
              </div>
            </Card>
          )}

          {order.refundSummary && (
            <Card>
              <SectionTitle>Refund Summary</SectionTitle>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="text-gray-500">Status</div><div>{order.refundSummary.refundStatus}</div>
                <div className="text-gray-500">Paid</div><div>{money(order.refundSummary.paidAmount ?? 0)}</div>
                <div className="text-gray-500">Refunded</div><div className="text-green-600">{money(order.refundSummary.amountRefunded ?? 0)}</div>
                <div className="text-gray-500">Net paid</div><div className="font-medium">{money(order.refundSummary.netPaid ?? 0)}</div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <PickerOpsCard orderNumber={order.orderNumber} orderStatus={order.status} storeId={order.storeId} />

          <Card>
            <SectionTitle>Event Timeline</SectionTitle>
            {loadingEvents ? (
              <Loading label="Loading events…" />
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-400">No events recorded.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-gray-100 pl-4">
                {events.map((ev, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.125rem] mt-1 h-2 w-2 rounded-full border-2 border-white bg-gray-400" />
                    <p className="text-xs font-semibold text-gray-700">{ev.eventType.replace(/_/g, ' ')}</p>
                    {(ev.fromStatus || ev.toStatus) && (
                      <p className="text-xs text-gray-400">
                        {ev.fromStatus ?? '—'} → {ev.toStatus ?? '—'}
                      </p>
                    )}
                    {ev.notes && <p className="text-xs text-gray-400 break-words">{ev.notes}</p>}
                    <p className="text-xs text-gray-300">{fmtDate(ev.occurredAt)} &middot; {ev.actorId}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
