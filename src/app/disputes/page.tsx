'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { Badge, ErrorBox, Loading, EmptyState, formatDate } from '@/components/ui';
import { DisputeTriageModal } from '@/components/DisputeTriageModal';
import { DISPUTE_STATUS_LABEL, DISPUTE_STATUS_TONE, useDisputes } from '@/lib/disputes';
import type { AdminDispute, DisputeStatus, DisputeSummary } from '@/lib/types';

const TABS: { status: DisputeStatus; label: string; countKey: keyof DisputeSummary }[] = [
  { status: 'OPEN', label: 'Open', countKey: 'open' },
  { status: 'UNDER_REVIEW', label: 'Under review', countKey: 'under_review' },
  { status: 'RESOLVED', label: 'Resolved', countKey: 'resolved' },
  { status: 'REJECTED', label: 'Rejected', countKey: 'rejected' }
];

export default function DisputesPage() {
  const setOpenCount = useDisputes((s) => s.setOpenCount);
  const [status, setStatus] = useState<DisputeStatus>('OPEN');
  const [items, setItems] = useState<AdminDispute[]>([]);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<DisputeSummary | null>(null);
  const [selected, setSelected] = useState<AdminDispute | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const s = await api.getDisputeSummary();
      setSummary(s);
      setOpenCount(s.open);
    } catch {
      // non-fatal
    }
  }, [setOpenCount]);

  const loadFirstPage = useCallback(async (st: DisputeStatus) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listDisputes(st);
      setItems(res.disputes);
      setCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(status);
  }, [status, loadFirstPage]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await api.listDisputes(status, cursor);
      setItems((prev) => [...prev, ...res.disputes]);
      setCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  function onUpdated() {
    loadFirstPage(status);
    loadSummary();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Disputes</h1>
        <p className="text-sm text-gray-500">Customer-reported issues. Triage open disputes and resolve or reject them.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((t) => {
          const active = status === t.status;
          const count = summary?.[t.countKey];
          return (
            <button
              key={t.status}
              onClick={() => setStatus(t.status)}
              className={
                'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ' +
                (active ? 'border-brand-green text-brand-green-dark' : 'border-transparent text-gray-500 hover:text-gray-700')
              }
            >
              {t.label}
              {typeof count === 'number' && count > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Loading label="Loading disputes…" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : items.length === 0 ? (
        <EmptyState>No disputes in this state.</EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <button
              key={d.dispute_id}
              onClick={() => setSelected(d)}
              className="card flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">{d.disposition_title || d.disposition_code}</div>
                <div className="truncate text-xs text-gray-500">Order {d.order_number} · Customer {d.customer_id}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-gray-400">{formatDate(d.created_at)}</span>
                <Badge tone={DISPUTE_STATUS_TONE[d.status]}>{DISPUTE_STATUS_LABEL[d.status]}</Badge>
              </div>
            </button>
          ))}
          {cursor && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-ghost w-full">
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}

      <DisputeTriageModal dispute={selected} onClose={() => setSelected(null)} onUpdated={onUpdated} />
    </div>
  );
}
