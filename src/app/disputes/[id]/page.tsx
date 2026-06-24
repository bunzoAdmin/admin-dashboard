'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { Badge, ErrorBox, Loading, Field, formatDate, useToast } from '@/components/ui';
import { DISPUTE_STATUS_LABEL, DISPUTE_STATUS_TONE } from '@/lib/disputes';
import type { AdminDisputeDetail, DisputeStatus } from '@/lib/types';

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useToast();
  const [dispute, setDispute] = useState<AdminDisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<DisputeStatus | null>(null);
  const [noteError, setNoteError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDispute(id);
      setDispute(res.dispute);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function act(target: DisputeStatus) {
    if (!dispute) return;
    if ((target === 'RESOLVED' || target === 'REJECTED') && note.trim() === '') {
      setNoteError(true);
      return;
    }
    setNoteError(false);
    setSubmitting(target);
    try {
      const res = await api.updateDispute(dispute.dispute_id, {
        status: target,
        resolution_note: note.trim() || undefined,
      });
      push('success', `Dispute ${DISPUTE_STATUS_LABEL[target].toLowerCase()}`);
      setDispute((prev) => prev ? { ...prev, ...res.dispute } : res.dispute as AdminDisputeDetail);
      setNote('');
    } catch (e) {
      push('error', e instanceof ApiClientError ? e.message : 'Failed to update dispute');
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) return <Loading label="Loading dispute…" />;
  if (error) return <ErrorBox message={error} />;
  if (!dispute) return null;

  const isTerminal = dispute.status === 'RESOLVED' || dispute.status === 'REJECTED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/disputes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← Disputes
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            Order {dispute.order_number}
          </h1>
          <p className="text-sm text-gray-500">
            {dispute.disposition_title || dispute.disposition_code} · Filed {formatDate(dispute.created_at)}
          </p>
        </div>
        <Badge tone={DISPUTE_STATUS_TONE[dispute.status]}>{DISPUTE_STATUS_LABEL[dispute.status]}</Badge>
      </div>

      {/* Customer description */}
      {dispute.description && (
        <div className="card p-4">
          <div className="label mb-1">Customer description</div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
        </div>
      )}

      {/* Photos — side by side */}
      {(dispute.photo_urls?.length || dispute.order?.driver_photo_url) && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Photos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="label mb-2">Customer photo</div>
              {dispute.photo_urls && dispute.photo_urls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {dispute.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Customer photo ${i + 1}`} className="h-40 w-full rounded-lg border border-gray-200 object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="h-40 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400">No photo</div>
              )}
            </div>
            <div>
              <div className="label mb-2">Driver photo</div>
              {dispute.order?.driver_photo_url ? (
                <a href={dispute.order.driver_photo_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dispute.order.driver_photo_url} alt="Driver photo" className="h-40 w-full rounded-lg border border-gray-200 object-cover" />
                </a>
              ) : (
                <div className="h-40 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400">No photo</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Details */}
      {dispute.order && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Order Details</h2>
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {dispute.order.pickup_completed_at && (
                <div>
                  <div className="label">Picked up</div>
                  <div className="text-gray-900">{formatDate(dispute.order.pickup_completed_at)}</div>
                </div>
              )}
              {dispute.order.drop_completed_at && (
                <div>
                  <div className="label">Dropped off</div>
                  <div className="text-gray-900">{formatDate(dispute.order.drop_completed_at)}</div>
                </div>
              )}
            </div>
            {dispute.order.items.length > 0 && (
              <div>
                <div className="label mb-2">Items</div>
                <div className="space-y-1">
                  {dispute.order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900">{item.name}</span>
                      <span className="text-gray-500">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver Details */}
      {dispute.driver && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Driver</h2>
          <div className="card p-4 text-sm space-y-1">
            <div className="font-semibold text-gray-900">{dispute.driver.name}</div>
            <div className="text-gray-500">{dispute.driver.phone_number}</div>
            <div className="text-gray-500">
              {dispute.driver.total_trips_completed} trips completed · Joined {formatDate(dispute.driver.created_at)}
            </div>
          </div>
        </div>
      )}

      {/* Resolution note (if resolved/rejected) */}
      {dispute.resolution_note && (
        <div className="card p-4 bg-gray-50">
          <div className="label">Resolution note</div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{dispute.resolution_note}</p>
          {dispute.resolved_by && <div className="text-xs text-gray-400 mt-1">by {dispute.resolved_by}</div>}
        </div>
      )}

      {/* Triage actions */}
      {!isTerminal && (
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Triage</h2>
          <Field label="Resolution note" hint="Required to resolve or reject.">
            <textarea
              className="input min-h-[80px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you do / why?"
            />
          </Field>
          {noteError && <p className="text-xs text-red-600">A note is required to resolve or reject.</p>}
          <div className="flex flex-wrap gap-2">
            {dispute.status === 'OPEN' && (
              <button onClick={() => act('UNDER_REVIEW')} disabled={submitting !== null} className="btn-ghost">
                {submitting === 'UNDER_REVIEW' ? 'Saving…' : 'Mark under review'}
              </button>
            )}
            <button onClick={() => act('RESOLVED')} disabled={submitting !== null} className="btn-primary">
              {submitting === 'RESOLVED' ? 'Saving…' : 'Resolve'}
            </button>
            <button onClick={() => act('REJECTED')} disabled={submitting !== null} className="btn-danger">
              {submitting === 'REJECTED' ? 'Saving…' : 'Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
