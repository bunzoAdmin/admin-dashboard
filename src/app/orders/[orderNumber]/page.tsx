'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import { api, ApiClientError } from '@/lib/api';
import type { OrderEventResponse, OrderResponse, OrderStatus } from '@/lib/orderAdminTypes';
import { CANCELLABLE_ORDER_STATUSES, ORDER_NEXT_STATUSES } from '@/lib/orderAdminTypes';
import { Badge, Card, ErrorBox, Loading, Spinner, SectionTitle, money, useToast } from '@/components/ui';
import { InvoiceOpsPanel } from '@/components/orders/InvoiceOpsPanel';
import { PickerOpsCard } from '@/components/pickers/PickerOpsCard';
import { Modal } from '@/components/Modal';
import { ArrowLeft } from 'lucide-react';
import {
  ageMinutesSince,
  ageToneClass,
  ageUrgencyTone,
  formatAgeMinutes,
  formatStoreDateTime,
  isTerminalOrderStatus
} from '@/lib/storeTime';

function orderStatusTone(status: string): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'DELIVERED': return 'green';
    case 'CONFIRMED': case 'PACKING': case 'READY_FOR_DELIVERY': case 'OUT_FOR_DELIVERY': return 'blue';
    case 'PENDING_PAYMENT': return 'amber';
    case 'CANCELLED': return 'red';
    default: return 'gray';
  }
}

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
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

  const nextStatuses = useMemo(
    () => (order ? ORDER_NEXT_STATUSES[order.status] ?? [] : []),
    [order]
  );

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

  async function handleStatusAdvance() {
    if (!statusTarget) return;
    setUpdatingStatus(true);
    try {
      if (statusTarget === 'DELIVERED') {
        // DELIVERED is driven by qcom drop completion (closes the trip, frees the
        // rider, and syncs the order), not a direct Java status write.
        await api.adminCompleteOrderDrop(orderNumber);
        await loadOrder();
      } else {
        const updated = await orderAdminApi.updateStatus(orderNumber, {
          status: statusTarget,
          notes: statusNotes.trim() || undefined
        });
        setOrder(updated);
      }
      await loadEvents();
      toast.push('success', `Status updated to ${statusTarget.replace(/_/g, ' ')}.`);
      setStatusTarget(null);
      setStatusNotes('');
    } catch (err) {
      toast.push(
        'error',
        err instanceof ApiClientError || err instanceof OrderAdminApiError ? err.message : 'Status update failed.'
      );
    } finally {
      setUpdatingStatus(false);
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

  const canCancel = CANCELLABLE_ORDER_STATUSES.includes(order.status);
  const waitingMinutes = ageMinutesSince(order.createdAt);
  const waitingTone = ageUrgencyTone(waitingMinutes, {
    terminal: isTerminalOrderStatus(order.status)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-bold text-gray-900">Order {order.orderNumber}</h1>
            <span className={`text-base ${ageToneClass(waitingTone)}`}>
              {isTerminalOrderStatus(order.status)
                ? `Age ${formatAgeMinutes(waitingMinutes)}`
                : `Waiting ${formatAgeMinutes(waitingMinutes)}`}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Customer: {order.customerId} &middot; Placed {formatStoreDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((s) => (
            <button
              key={s}
              type="button"
              className="btn-primary text-sm"
              onClick={() => {
                setStatusTarget(s);
                setStatusNotes('');
              }}
            >
              Advance to {s.replace(/_/g, ' ')}
            </button>
          ))}
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

          {order.status === 'DELIVERED' && (
            <Card>
              <SectionTitle>Invoice</SectionTitle>
              <InvoiceOpsPanel
                orderNumber={order.orderNumber}
                invoice={order.invoice}
                compact
                onUpdated={(invoice) => setOrder(prev => prev ? { ...prev, invoice } : prev)}
              />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <PickerOpsCard
            orderNumber={order.orderNumber}
            orderStatus={order.status}
            storeId={order.storeId}
            onTaskChanged={() => {
              loadOrder();
              loadEvents();
            }}
          />

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
                    <p className="text-xs text-gray-300">{formatStoreDateTime(ev.occurredAt)} &middot; {ev.actorId}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget ? `Advance to ${statusTarget.replace(/_/g, ' ')}` : 'Advance status'}
      >
        <div className="space-y-4">
          {statusTarget === 'DELIVERED' ? (
            <p className="text-sm text-gray-600">
              Mark this order delivered? This completes the rider&apos;s drop, closes the trip, and marks the
              order delivered — the same as completing the drop from the driver page.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Move order from <strong>{order.status.replace(/_/g, ' ')}</strong> to{' '}
              <strong>{statusTarget?.replace(/_/g, ' ')}</strong>?
              Manual advances into picker-owned states fail if an active pick task still owns fulfillment.
            </p>
          )}
          {statusTarget !== 'DELIVERED' && (
            <label className="block space-y-1.5">
              <span className="label">Notes (optional)</span>
              <input
                className="input w-full"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Why is ops advancing this status?"
              />
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStatusTarget(null)}>
              Back
            </button>
            <button type="button" className="btn-primary" disabled={updatingStatus} onClick={handleStatusAdvance}>
              {updatingStatus ? <Spinner className="h-4 w-4" /> : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
