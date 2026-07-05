'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { BannerSlotResponse } from '@/lib/catalogTypes';
import { formatDaysOfWeek } from '@/lib/catalogTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, useToast } from '@/components/ui';

function formatTime(t: string): string {
  // "HH:mm:ss" → "HH:mm"
  return t?.slice(0, 5) ?? t;
}

export default function SlotsPage() {
  const toast = useToast();
  const [slots, setSlots] = useState<BannerSlotResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSlots(await catalogApi.listBannerSlots());
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load slots.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(slot: BannerSlotResponse) {
    if (!confirm(`Delete schedule "${slot.name}"? All banner assignments within it will be removed.`)) return;
    setDeleting(slot.id);
    try {
      await catalogApi.deleteBannerSlot(slot.id);
      toast.push('success', `Schedule "${slot.name}" deleted.`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to delete schedule.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Banner Schedules</h1>
          <p className="text-sm text-gray-500">
            Named collections of banners with a recurring day + time window (Africa/Lusaka). The highest-priority active schedule is shown in the home carousel.
          </p>
        </div>
        <Link href="/catalog/slots/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New schedule
        </Link>
      </div>

      {loadError && <ErrorBox message={loadError} />}
      {slots === null && !loadError && <Loading label="Loading slots…" />}
      {slots?.length === 0 && <EmptyState>No schedules yet. Create a schedule and assign banners to it.</EmptyState>}

      {slots && slots.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => (
            <Card key={slot.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 truncate">{slot.name}</span>
                    <Badge tone={slot.isActive ? 'green' : 'gray'}>
                      {slot.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {slot.priority > 0 && (
                      <Badge tone="amber">Priority {slot.priority}</Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-gray-400">{slot.slug}</p>
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <p><span className="text-xs font-medium uppercase tracking-wide text-gray-400">Days</span>{' '}
                  {formatDaysOfWeek(slot.daysOfWeek)}
                </p>
                <p>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Time</span>{' '}
                  {formatTime(slot.startTime)} – {formatTime(slot.endTime)} CAT
                </p>
                <p>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Banners</span>{' '}
                  {slot.banners?.length ?? 0} assigned
                </p>
              </div>

              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <Link href={`/catalog/slots/${slot.id}`} className="btn-ghost text-sm">
                  <Pencil className="h-3.5 w-3.5" /> Manage
                </Link>
                <button
                  type="button"
                  className="btn-ghost text-sm text-red-600 hover:bg-red-50"
                  disabled={deleting === slot.id}
                  onClick={() => handleDelete(slot)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting === slot.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
