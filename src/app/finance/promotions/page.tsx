'use client';

import { useCallback, useEffect, useState } from 'react';
import { promotionAdminApi, PromotionAdminApiError } from '@/lib/promotionAdminApi';
import { api } from '@/lib/api';
import type { Darkstore } from '@/lib/types';
import type {
  CreatePromotionRequest,
  CouponInteraction,
  DiscountType,
  Promotion,
  PromotionAudience,
  PromotionItem
} from '@/lib/promotionAdminTypes';
import { AUDIENCE_OPTIONS, INTERACTION_OPTIONS } from '@/lib/promotionAdminTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, SectionTitle, Spinner, useToast } from '@/components/ui';
import { SkuMultiPicker } from '@/components/zra/SkuPicker';
import { Plus, X } from 'lucide-react';

const CAT = 'Africa/Lusaka';

function isoToCatInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function catInputToIso(local: string): string | null {
  if (!local) return null;
  return new Date(`${local}:00+02:00`).toISOString();
}

function fmtWindow(p: Promotion) {
  const fmt = (iso?: string | null) => {
    if (!iso) return 'open';
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: CAT,
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };
  return `${fmt(p.startsAt)} → ${fmt(p.endsAt)}`;
}

function itemsValid(items: ItemDraft[]): string | null {
  for (const item of items) {
    if (!Number.isFinite(item.discountValue) || item.discountValue <= 0) {
      return 'Each SKU needs a discount greater than 0.';
    }
    if (item.discountType === 'PERCENTAGE' && item.discountValue > 100) {
      return 'Percentage discount cannot exceed 100.';
    }
    if (!Number.isFinite(item.maxQty) || item.maxQty < 1) {
      return 'Max qty must be at least 1.';
    }
  }
  return null;
}

type ItemDraft = { sku: string; discountType: DiscountType; discountValue: number; maxQty: number };

const BLANK: Omit<CreatePromotionRequest, 'items'> & { items: ItemDraft[] } = {
  name: '',
  enabled: false,
  storeId: null,
  startsAt: null,
  endsAt: null,
  audience: 'FIRST_N_ORDERS',
  maxCompletedOrders: 0,
  couponInteraction: 'STACK_FULL_CART',
  priority: 0,
  badgeText: '',
  displayHeadline: '',
  items: []
};

function itemsFromPromotion(p: Promotion): ItemDraft[] {
  return (p.items ?? []).map((i: PromotionItem) => ({
    sku: i.sku,
    discountType: i.discountType,
    discountValue: Number(i.discountValue),
    maxQty: i.maxQty
  }));
}

function storeLabel(storeId: number | null | undefined, stores: Darkstore[]) {
  if (storeId == null) return 'All stores';
  const name = stores.find((s) => parseInt(s.darkstore_id, 10) === storeId)?.name;
  return name ? `${name} (#${storeId})` : `Store ${storeId}`;
}

export default function PromotionsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Promotion[] | null>(null);
  const [stores, setStores] = useState<Darkstore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [editForm, setEditForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await promotionAdminApi.list());
    } catch (err) {
      setError(err instanceof PromotionAdminApiError ? err.message : 'Failed to load promotions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.listDarkstores({ all: true })
      .then((res) => setStores([...res.darkstores].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setStores([]));
  }, []);

  function setSkus(items: ItemDraft[], skus: string[], setter: (items: ItemDraft[]) => void) {
    const bySku = new Map(items.map((i) => [i.sku, i]));
    setter(
      skus.map(
        (sku) => bySku.get(sku) ?? { sku, discountType: 'PERCENTAGE', discountValue: 10, maxQty: 1 }
      )
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.items.length === 0) {
      toast.push('error', 'Add at least one SKU.');
      return;
    }
    const itemError = itemsValid(form.items);
    if (itemError) {
      toast.push('error', itemError);
      return;
    }
    setCreating(true);
    try {
      const created = await promotionAdminApi.create({
        ...form,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        maxCompletedOrders: form.audience === 'FIRST_N_ORDERS' ? form.maxCompletedOrders ?? 0 : null,
        storeId: form.storeId ?? null
      });
      setRows((prev) => (prev ? [created, ...prev] : [created]));
      toast.push('success', `Promotion “${created.name}” created.`);
      setShowCreate(false);
      setForm(BLANK);
    } catch (err) {
      toast.push('error', err instanceof PromotionAdminApiError ? err.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(p: Promotion) {
    setToggling(p.id);
    try {
      const updated = await promotionAdminApi.patch(p.id, { enabled: !p.enabled });
      setRows((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
      toast.push('success', `Promotion ${updated.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      toast.push('error', err instanceof PromotionAdminApiError ? err.message : 'Toggle failed.');
    } finally {
      setToggling(null);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (editForm.items.length === 0) {
      toast.push('error', 'Add at least one SKU.');
      return;
    }
    const itemError = itemsValid(editForm.items);
    if (itemError) {
      toast.push('error', itemError);
      return;
    }
    setSaving(true);
    try {
      const updated = await promotionAdminApi.patch(editing.id, {
        name: editForm.name,
        enabled: editForm.enabled,
        startsAt: editForm.startsAt || null,
        endsAt: editForm.endsAt || null,
        clearStartsAt: !editForm.startsAt,
        clearEndsAt: !editForm.endsAt,
        audience: editForm.audience,
        maxCompletedOrders: editForm.audience === 'FIRST_N_ORDERS' ? editForm.maxCompletedOrders ?? 0 : null,
        ...(editForm.storeId != null ? { storeId: editForm.storeId } : { clearStoreId: true }),
        couponInteraction: editForm.couponInteraction,
        priority: editForm.priority,
        badgeText: editForm.badgeText,
        displayHeadline: editForm.displayHeadline,
        items: editForm.items
      });
      setRows((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
      toast.push('success', 'Promotion updated.');
      setEditing(null);
    } catch (err) {
      toast.push('error', err instanceof PromotionAdminApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete promotion “${name}”? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await promotionAdminApi.remove(id);
      setRows((prev) => prev?.filter((r) => r.id !== id) ?? null);
      toast.push('success', 'Promotion deleted.');
    } catch (err) {
      toast.push('error', err instanceof PromotionAdminApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product promotions</h1>
          <p className="text-sm text-gray-500">
            Auto-applied SKU deals. Leave store as “All stores” or pick one store so other locations are
            untouched. First-N is counted per customer at that store (or across all stores if All is
            selected). Cancelled / failed-payment orders do not use up the offer. An unpaid pending
            order does until it is cancelled.
          </p>
        </div>
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" /> New promotion
        </button>
      </div>

      {showCreate && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>New promotion</SectionTitle>
            <button className="btn-ghost p-1" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <PromotionForm
            form={form}
            setForm={setForm}
            stores={stores}
            onSubmit={handleCreate}
            submitting={creating}
            submitLabel="Create"
            onSkus={(skus) => setSkus(form.items, skus, (items) => setForm((f) => ({ ...f, items })))}
          />
        </Card>
      )}

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && rows === null ? (
          <div className="p-6">
            <Loading label="Loading promotions…" />
          </div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No promotions yet.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                  <th className="px-4 py-3 font-medium">Audience</th>
                  <th className="px-4 py-3 font-medium">SKUs</th>
                  <th className="px-4 py-3 font-medium">Coupons</th>
                  <th className="px-4 py-3 font-medium">Enabled</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{storeLabel(p.storeId, stores)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtWindow(p)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.audience === 'FIRST_N_ORDERS'
                        ? `First ${(p.maxCompletedOrders ?? 0) + 1} order(s)`
                        : 'Everyone'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.items?.length ?? 0}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-gray-500">
                      {p.couponInteraction.replace(/_/g, ' ').toLowerCase()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-0.5 text-xs"
                        disabled={toggling === p.id}
                        onClick={() => handleToggle(p)}
                      >
                        {toggling === p.id ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          <Badge tone={p.enabled ? 'green' : 'gray'}>{p.enabled ? 'On' : 'Off'}</Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => {
                            setEditing(p);
                            setEditForm({
                              name: p.name,
                              enabled: p.enabled,
                              storeId: p.storeId ?? null,
                              startsAt: p.startsAt ?? null,
                              endsAt: p.endsAt ?? null,
                              audience: p.audience,
                              maxCompletedOrders: p.maxCompletedOrders ?? 0,
                              couponInteraction: p.couponInteraction,
                              priority: p.priority,
                              badgeText: p.badgeText ?? '',
                              displayHeadline: p.displayHeadline ?? '',
                              items: itemsFromPromotion(p)
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs text-red-600"
                          disabled={deleting === p.id}
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          {deleting === p.id ? <Spinner className="h-3 w-3" /> : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Edit {editing.name}</h2>
              <button className="btn-ghost p-1" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <PromotionForm
              form={editForm}
              setForm={setEditForm}
              stores={stores}
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              submitting={saving}
              submitLabel="Save"
              onSkus={(skus) => setSkus(editForm.items, skus, (items) => setEditForm((f) => ({ ...f, items })))}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function PromotionForm({
  form,
  setForm,
  stores,
  onSubmit,
  submitting,
  submitLabel,
  onSkus
}: {
  form: typeof BLANK;
  setForm: (fn: typeof BLANK | ((f: typeof BLANK) => typeof BLANK)) => void;
  stores: Darkstore[];
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitLabel: string;
  onSkus: (skus: string[]) => void;
}) {
  const set = (patch: Partial<typeof BLANK>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label">Name</span>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Mealie meal first order"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Store</span>
          <select
            className="input"
            value={form.storeId == null ? '' : String(form.storeId)}
            onChange={(e) =>
              set({ storeId: e.target.value === '' ? null : parseInt(e.target.value, 10) })
            }
          >
            <option value="">All stores</option>
            {form.storeId != null &&
              !stores.some((s) => parseInt(s.darkstore_id, 10) === form.storeId) && (
                <option value={form.storeId}>Store {form.storeId}</option>
              )}
            {stores.map((s) => (
              <option key={s.darkstore_id} value={s.darkstore_id}>
                {s.name} (#{s.darkstore_id})
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            All stores applies everywhere. A specific store never affects other locations; first-N is
            counted only there.
          </span>
        </label>
        <label className="flex items-center gap-2 pt-7">
          <input
            type="checkbox"
            checked={!!form.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          <span className="text-sm text-gray-700">Enable immediately (leave off until verified)</span>
        </label>
        <label className="block space-y-1.5">
          <span className="label">Headline (checkout)</span>
          <input
            className="input"
            value={form.displayHeadline ?? ''}
            onChange={(e) => set({ displayHeadline: e.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Starts (CAT)</span>
          <input
            className="input"
            type="datetime-local"
            value={isoToCatInput(form.startsAt)}
            onChange={(e) => set({ startsAt: catInputToIso(e.target.value) })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Ends (CAT)</span>
          <input
            className="input"
            type="datetime-local"
            value={isoToCatInput(form.endsAt)}
            onChange={(e) => set({ endsAt: catInputToIso(e.target.value) })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Audience</span>
          <select
            className="input"
            value={form.audience}
            onChange={(e) => set({ audience: e.target.value as PromotionAudience })}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {form.audience === 'FIRST_N_ORDERS' && (
          <label className="block space-y-1.5">
            <span className="label">Max prior counted orders (0 = first order only)</span>
            <input
              className="input"
              type="number"
              min={0}
              value={form.maxCompletedOrders ?? 0}
              onChange={(e) => set({ maxCompletedOrders: parseInt(e.target.value, 10) })}
            />
          </label>
        )}
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="label">Coupon interaction</span>
          <select
            className="input"
            value={form.couponInteraction}
            onChange={(e) => set({ couponInteraction: e.target.value as CouponInteraction })}
          >
            {INTERACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="label">Priority (higher wins if two promos hit the same SKU)</span>
          <input
            className="input"
            type="number"
            value={form.priority ?? 0}
            onChange={(e) => set({ priority: parseInt(e.target.value, 10) })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Badge text (app later)</span>
          <input
            className="input"
            value={form.badgeText ?? ''}
            onChange={(e) => set({ badgeText: e.target.value })}
          />
        </label>
      </div>

      <SkuMultiPicker
        skus={form.items.map((i) => i.sku)}
        onChange={onSkus}
        label="SKUs"
        hint="Each SKU can have its own discount and max quantity."
      />

      {form.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="py-2">SKU</th>
                <th className="py-2">Type</th>
                <th className="py-2">Value</th>
                <th className="py-2">Max qty</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={item.sku}>
                  <td className="py-1 font-mono text-xs">{item.sku}</td>
                  <td className="py-1 pr-2">
                    <select
                      className="input"
                      value={item.discountType}
                      onChange={(e) => {
                        const discountType = e.target.value as DiscountType;
                        setForm((f) => ({
                          ...f,
                          items: f.items.map((it, i) => (i === idx ? { ...it, discountType } : it))
                        }));
                      }}
                    >
                      <option value="PERCENTAGE">Percent</option>
                      <option value="FIXED_AMOUNT">ZMW off</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className="input"
                      type="number"
                      min={0.01}
                      max={item.discountType === 'PERCENTAGE' ? 100 : undefined}
                      step="0.01"
                      required
                      value={Number.isFinite(item.discountValue) ? item.discountValue : ''}
                      onChange={(e) => {
                        const discountValue = parseFloat(e.target.value);
                        setForm((f) => ({
                          ...f,
                          items: f.items.map((it, i) => (i === idx ? { ...it, discountValue } : it))
                        }));
                      }}
                    />
                  </td>
                  <td className="py-1">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      required
                      value={item.maxQty}
                      onChange={(e) => {
                        const maxQty = parseInt(e.target.value, 10);
                        setForm((f) => ({
                          ...f,
                          items: f.items.map((it, i) => (i === idx ? { ...it, maxQty } : it))
                        }));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? <Spinner className="h-4 w-4" /> : submitLabel}
      </button>
    </form>
  );
}
