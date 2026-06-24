'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { Badge, Field, formatDate, useToast } from './ui';
import { api, ApiClientError } from '@/lib/api';
import { DISPUTE_STATUS_LABEL, DISPUTE_STATUS_TONE } from '@/lib/disputes';
import type { AdminDispute, DisputeStatus } from '@/lib/types';

export function DisputeTriageModal({
  dispute,
  onClose,
  onUpdated
}: {
  dispute: AdminDispute | null;
  onClose: () => void;
  onUpdated: (d: AdminDispute) => void;
}) {
  const { push } = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<DisputeStatus | null>(null);
  const [noteError, setNoteError] = useState(false);

  if (!dispute) return null;
  const isTerminal = dispute.status === 'RESOLVED' || dispute.status === 'REJECTED';

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
        resolution_note: note.trim() || undefined
      });
      push('success', `Dispute ${DISPUTE_STATUS_LABEL[target].toLowerCase()}`);
      onUpdated(res.dispute);
      setNote('');
      onClose();
    } catch (e) {
      push('error', e instanceof ApiClientError ? e.message : 'Failed to update dispute');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Modal open={!!dispute} onClose={onClose} title={`Dispute · Order ${dispute.order_number}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge tone={DISPUTE_STATUS_TONE[dispute.status]}>{DISPUTE_STATUS_LABEL[dispute.status]}</Badge>
          <span className="text-xs text-gray-400">{formatDate(dispute.created_at)}</span>
        </div>

        <div className="space-y-1 text-sm">
          <div className="font-medium text-gray-900">{dispute.disposition_title || dispute.disposition_code}</div>
          <div className="text-gray-500">Customer: {dispute.customer_id}</div>
          {dispute.description && <p className="whitespace-pre-wrap text-gray-700">{dispute.description}</p>}
        </div>

        {dispute.photo_urls && dispute.photo_urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dispute.photo_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Dispute photo ${i + 1}`} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
              </a>
            ))}
          </div>
        )}

        {dispute.resolution_note && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <div className="label">Resolution note</div>
            <p className="whitespace-pre-wrap">{dispute.resolution_note}</p>
            {dispute.resolved_by && <div className="mt-1 text-xs text-gray-400">by {dispute.resolved_by}</div>}
          </div>
        )}

        {!isTerminal && (
          <>
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
          </>
        )}
      </div>
    </Modal>
  );
}
