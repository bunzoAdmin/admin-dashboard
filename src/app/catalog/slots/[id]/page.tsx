'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Clock, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { BannerResponse, BannerSlotResponse, SlotBannerItem } from '@/lib/catalogTypes';
import { formatDaysOfWeek } from '@/lib/catalogTypes';
import { resolveCatalogImageUrl } from '@/lib/catalogImageUrl';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';
import { SlotForm } from '@/components/catalog/SlotForm';

function formatTime(t: string): string {
  return t?.slice(0, 5) ?? t;
}

export default function SlotDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const slotId = Number(params.id);

  const [slot, setSlot] = useState<BannerSlotResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editing schedule
  const [editingSchedule, setEditingSchedule] = useState(false);

  // Assign banner panel
  const [showAssign, setShowAssign] = useState(false);
  const [allBanners, setAllBanners] = useState<BannerResponse[] | null>(null);
  const [assignId, setAssignId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Drag-to-reorder
  const [orderedItems, setOrderedItems] = useState<SlotBannerItem[]>([]);
  const [rankDirty, setRankDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await catalogApi.getBannerSlot(slotId);
      setSlot(s);
      setOrderedItems(s.banners ?? []);
      setRankDirty(false);
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load schedule.');
    }
  }, [slotId]);

  useEffect(() => { load(); }, [load]);

  // Load all banners for the assign dropdown
  async function openAssign() {
    setAssignError(null);
    setAssignId('');
    setShowAssign(true);
    if (!allBanners) {
      try {
        setAllBanners(await catalogApi.listBanners());
      } catch {
        setAssignError('Failed to load banners.');
      }
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    const bannerId = Number(assignId);
    if (!bannerId) { setAssignError('Select a banner.'); return; }

    const nextRank = (orderedItems.length > 0
      ? Math.max(...orderedItems.map((i) => i.rank))
      : 0) + 1;

    setAssigning(true);
    setAssignError(null);
    try {
      await catalogApi.assignBannerToSlot(slotId, { bannerId, rank: nextRank });
      toast.push('success', 'Banner assigned.');
      setShowAssign(false);
      await load();
    } catch (err) {
      setAssignError(err instanceof CatalogApiError ? err.message : 'Failed to assign.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(item: SlotBannerItem) {
    if (!confirm(`Remove "${item.banner.title}" from this slot?`)) return;
    try {
      await catalogApi.removeBannerFromSlot(slotId, item.bannerId);
      toast.push('success', 'Banner removed from slot.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to remove.');
    }
  }

  // ── Drag-to-reorder ────────────────────────────────────────────────────────
  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, overIdx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === overIdx) return;
    setOrderedItems((items) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(overIdx, 0, moved);
      dragIdx.current = overIdx;
      return next;
    });
    setRankDirty(true);
  }

  function onDragEnd() {
    dragIdx.current = null;
  }

  async function saveOrder() {
    setSaving(true);
    try {
      await catalogApi.reorderSlotBanners(slotId, {
        items: orderedItems.map((item, idx) => ({ bannerId: item.bannerId, rank: idx + 1 }))
      });
      toast.push('success', 'Banner order saved.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadError) return <ErrorBox message={loadError} />;
  if (!slot) return <Loading label="Loading schedule…" />;

  // Banners not yet in this slot — for assign dropdown
  const assignedIds = new Set(orderedItems.map((i) => i.bannerId));
  const availableBanners = allBanners?.filter((b) => !assignedIds.has(b.id)) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{slot.name}</h1>
            <Badge tone={slot.isActive ? 'green' : 'gray'}>{slot.isActive ? 'Active' : 'Inactive'}</Badge>
            {slot.priority > 0 && <Badge tone="amber">Priority {slot.priority}</Badge>}
          </div>
          <p className="text-sm text-gray-500 font-mono">{slot.slug}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => setEditingSchedule((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" />
            {editingSchedule ? 'Cancel edit' : 'Edit schedule'}
          </button>
          <button className="btn-ghost text-sm" onClick={() => router.push('/catalog/slots')}>
            ← All schedules
          </button>
        </div>
      </div>

      {/* Schedule summary */}
      {!editingSchedule && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Schedule (Africa/Lusaka)</h2>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Days</dt>
              <dd className="mt-0.5 text-gray-800">{formatDaysOfWeek(slot.daysOfWeek)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Time window</dt>
              <dd className="mt-0.5 text-gray-800">
                {formatTime(slot.startTime)} – {formatTime(slot.endTime)} CAT
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Priority</dt>
              <dd className="mt-0.5 text-gray-800">{slot.priority}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Inline schedule editor */}
      {editingSchedule && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Edit schedule</h2>
          <SlotForm editing={slot} />
        </Card>
      )}

      {/* Banner list */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Banners ({orderedItems.length})
          </h2>
          <div className="flex gap-2">
            {rankDirty && (
              <button className="btn-primary text-sm" disabled={saving} onClick={saveOrder}>
                {saving ? <Spinner className="h-4 w-4" /> : 'Save order'}
              </button>
            )}
            <button className="btn-ghost text-sm" onClick={openAssign}>
              <Plus className="h-3.5 w-3.5" /> Assign banner
            </button>
          </div>
        </div>

        {orderedItems.length === 0 ? (
          <EmptyState>No banners assigned yet. Click "Assign banner" to add one.</EmptyState>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Drag rows to reorder. Click "Save order" when done.</p>
            {orderedItems.map((item, idx) => {
              const imgUrl = resolveCatalogImageUrl(item.banner.imageUrl);
              return (
                <div
                  key={item.bannerId}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 cursor-grab active:cursor-grabbing hover:border-gray-300 transition"
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-gray-300" />
                  <span className="w-6 shrink-0 text-center text-sm font-mono text-gray-400">{idx + 1}</span>

                  {/* Thumbnail */}
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt={item.banner.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-300">
                        No img
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{item.banner.title}</p>
                    <p className="font-mono text-xs text-gray-400 truncate">{item.banner.slug}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge tone={item.banner.isActive ? 'green' : 'gray'}>
                        {item.banner.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs text-gray-500">{item.banner.actionType}</span>
                      <span className="text-xs text-gray-400">
                        {item.banner.actionItemIds.length} IDs
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Remove from slot"
                    className="btn-ghost text-red-500 hover:bg-red-50 p-1.5"
                    onClick={() => handleRemove(item)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign banner panel */}
      {showAssign && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assign a banner</h2>
            <button type="button" className="btn-ghost p-1" onClick={() => setShowAssign(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {assignError && <ErrorBox message={assignError} />}
          {allBanners === null ? (
            <Loading label="Loading banners…" />
          ) : availableBanners.length === 0 ? (
            <p className="text-sm text-gray-500">All banners are already assigned to this slot.</p>
          ) : (
            <form onSubmit={handleAssign} className="flex items-end gap-3">
              <Field label="Banner" className="flex-1">
                <select
                  className="input"
                  value={assignId}
                  onChange={(e) => setAssignId(e.target.value)}
                >
                  <option value="">— select —</option>
                  {availableBanners.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (#{b.id}) · {b.actionType}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="btn-primary" disabled={assigning || !assignId}>
                {assigning ? <Spinner className="h-4 w-4" /> : 'Assign'}
              </button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
