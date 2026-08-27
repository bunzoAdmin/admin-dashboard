'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import { api, ApiClientError } from '@/lib/api';
import type { OrderEventResponse, OrderResponse, OrderStatus } from '@/lib/orderAdminTypes';
import { CANCELLABLE_ORDER_STATUSES, ORDER_NEXT_STATUSES } from '@/lib/orderAdminTypes';
import { Badge, Card, ErrorBox, Field, Loading, Spinner, SectionTitle, money, useToast } from '@/components/ui';
import { InvoiceOpsPanel } from '@/components/orders/InvoiceOpsPanel';
import { PickerOpsCard } from '@/components/pickers/PickerOpsCard';
import { pickerApi } from '@/lib/pickerApi';
import { Modal } from '@/components/Modal';
import { ArrowLeft } from 'lucide-react';
import type { AdminDropPreview } from '@/lib/types';
import { adminDropConfirmLabel, canConfirmAdminDrop } from '@/lib/adminDropPreview';
import {
  ageToneClass,
  ageUrgencyTone,
  formatAgeMinutes,
  formatStoreDateTime,
  isTerminalOrderStatus,
  orderOpsAgeMinutes
} from '@/lib/storeTime';

function blockedDropMessage(reason?: string): string {
  switch (reason) {
    case 'java_cancelled':
      return 'This order is cancelled.';
    case 'java_not_ready':
      return 'Order is not ready for delivery yet.';
    case 'rider_busy_elsewhere':
      return 'Assigned rider is on another trip. Reassign this order first.';
    default:
      return reason ? `Cannot mark delivered (${reason}).` : 'This order cannot be marked delivered.';
  }
}

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
  const [dropPreview, setDropPreview] = useState<AdminDropPreview | null>(null);
  const [dropPreviewLoading, setDropPreviewLoading] = useState(false);
  const [dropPreviewError, setDropPreviewError] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [resolvePickOpen, setResolvePickOpen] = useState(false);

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

  useEffect(() => {
    if (statusTarget !== 'DELIVERED') {
      setDropPreview(null);
      setDropPreviewError(null);
      setDropPreviewLoading(false);
      setSelectedPhone('');
      return;
    }
    let cancelled = false;
    setDropPreview(null);
    setDropPreviewError(null);
    setSelectedPhone('');
    setDropPreviewLoading(true);
    api
      .getAdminDropPreview(orderNumber)
      .then((preview) => {
        if (!cancelled) setDropPreview(preview);
      })
      .catch((err) => {
        if (!cancelled) {
          setDropPreviewError(
            err instanceof ApiClientError ? err.message : 'Failed to load delivery preview.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDropPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusTarget, orderNumber]);

  const nextStatuses = useMemo(
    () => (order ? ORDER_NEXT_STATUSES[order.status] ?? [] : []),
    [order]
  );

  const orderItemsForResolve = useMemo(
    () =>
      order?.items.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        orderedQuantity: item.orderedQuantity
      })) ?? [],
    [order?.items]
  );

  async function handleAdvanceClick(target: OrderStatus) {
    if (
      target === 'READY_FOR_DELIVERY' &&
      order &&
      (order.status === 'PACKING' || order.status === 'CONFIRMED')
    ) {
      try {
        const task = await pickerApi.getTaskForOrder(order.orderNumber);
        if (task?.status === 'PICKED') {
          setStatusTarget(target);
          setStatusNotes('');
          return;
        }
      } catch {
        // No task or fetch failed — resolve path creates/completes as needed.
      }
      setResolvePickOpen(true);
      return;
    }
    setStatusTarget(target);
    setStatusNotes('');
  }

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
        if (!dropPreview || !canConfirmAdminDrop(dropPreview.mode, selectedPhone)) return;
        await api.adminCompleteOrderDrop(orderNumber, selectedPhone || undefined);
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
  const terminal = isTerminalOrderStatus(order.status);
  const waitingMinutes = orderOpsAgeMinutes({
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelledAt: order.cancelledAt
  });
  const waitingTone = ageUrgencyTone(waitingMinutes, { terminal });

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
              {terminal
                ? `Took ${formatAgeMinutes(waitingMinutes)}`
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
              onClick={() => handleAdvanceClick(s)}
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
                items={order.items}
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
            orderItems={orderItemsForResolve}
            resolveOpen={resolvePickOpen}
            onResolveOpenChange={setResolvePickOpen}
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
            dropPreviewLoading ? (
              <Loading label="Loading delivery preview…" />
            ) : dropPreviewError ? (
              <ErrorBox message={dropPreviewError} />
            ) : dropPreview ? (
              <AdminDropPreviewBody
                preview={dropPreview}
                selectedPhone={selectedPhone}
                onSelectPhone={setSelectedPhone}
              />
            ) : null
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
            {statusTarget !== 'DELIVERED' && (
              <button type="button" className="btn-primary" disabled={updatingStatus} onClick={handleStatusAdvance}>
                {updatingStatus ? <Spinner className="h-4 w-4" /> : 'Confirm'}
              </button>
            )}
            {statusTarget === 'DELIVERED' &&
              dropPreview &&
              dropPreview.mode !== 'blocked' &&
              dropPreview.mode !== 'already_done' && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={updatingStatus || !canConfirmAdminDrop(dropPreview.mode, selectedPhone)}
                  onClick={handleStatusAdvance}
                >
                  {updatingStatus ? <Spinner className="h-4 w-4" /> : adminDropConfirmLabel(dropPreview.mode)}
                </button>
              )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AdminDropPreviewBody({
  preview,
  selectedPhone,
  onSelectPhone
}: {
  preview: AdminDropPreview;
  selectedPhone: string;
  onSelectPhone: (phone: string) => void;
}) {
  if (preview.mode === 'blocked') {
    return <ErrorBox message={blockedDropMessage(preview.reason)} />;
  }
  if (preview.mode === 'already_done') {
    return <p className="text-sm text-gray-600">Already delivered.</p>;
  }
  if (preview.mode === 'java_only') {
    return (
      <p className="text-sm text-gray-600">
        No delivery trip exists. This will mark the order delivered in order-service only (no rider COD/payout).
      </p>
    );
  }
  if (preview.mode === 'force_progress') {
    const name = preview.rider?.name ?? 'the assigned rider';
    const phone = preview.rider?.phone ?? '';
    return (
      <p className="text-sm text-gray-600">
        Mark delivered for {name}{phone ? ` (${phone})` : ''}? This will complete pickup if needed, then the drop.
      </p>
    );
  }
  const candidates = preview.candidates ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Select a rider to assign, then mark this order delivered.</p>
      {candidates.length === 0 ? (
        <p className="text-sm text-gray-500">No eligible riders at this store.</p>
      ) : (
        <Field label="Rider">
          <select className="input" value={selectedPhone} onChange={(e) => onSelectPhone(e.target.value)}>
            <option value="">Select rider…</option>
            {candidates.map((c) => (
              <option key={c.phone} value={c.phone}>
                {c.name} — {c.phone} — {c.status} — K{c.in_hand_cash_zmw}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
