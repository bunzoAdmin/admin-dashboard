'use client';

import { useCallback, useEffect, useState } from 'react';
import { cartGiftAdminApi, CartGiftAdminApiError } from '@/lib/cartGiftAdminApi';
import { api } from '@/lib/api';
import type { CartGift, CreateCartGiftRequest } from '@/lib/cartGiftAdminTypes';
import type { Darkstore } from '@/lib/types';
import { Badge, Card, EmptyState, ErrorBox, Loading, SectionTitle, Spinner, useToast } from '@/components/ui';
import { SkuPicker } from '@/components/zra/SkuPicker';
import { Plus, X } from 'lucide-react';

const CAT = 'Africa/Lusaka';

type FormState = {
  name: string;
  enabled: boolean;
  storeId: number | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  minSubtotal: string;
  sku: string;
  freeQty: string;
  badgeText: string;
  displayHeadline: string;
};

const BLANK: FormState = {
  name: '',
  enabled: false,
  storeId: null,
  startsAt: null,
  endsAt: null,
  priority: 0,
  minSubtotal: '249',
  sku: '',
  freeQty: '1',
  badgeText: '',
  displayHeadline: ''
};

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

function fmtWindow(gift: CartGift) {
  const fmt = (iso?: string | null) => {
    if (!iso) return 'open';
    return new Date(iso).toLocaleString('en-GB', { timeZone: CAT, dateStyle: 'short', timeStyle: 'short' });
  };
  return `${fmt(gift.startsAt)} → ${fmt(gift.endsAt)}`;
}

function storeLabel(storeId: number | null | undefined, stores: Darkstore[]) {
  if (storeId == null) return 'All stores';
  const name = stores.find((s) => parseInt(s.darkstore_id, 10) === storeId)?.name;
  return name ? `${name} (#${storeId})` : `Store ${storeId}`;
}

function fromGift(gift: CartGift): FormState {
  return {
    name: gift.name,
    enabled: gift.enabled,
    storeId: gift.storeId ?? null,
    startsAt: gift.startsAt ?? null,
    endsAt: gift.endsAt ?? null,
    priority: gift.priority,
    minSubtotal: String(gift.minSubtotal),
    sku: gift.sku,
    freeQty: String(gift.freeQty),
    badgeText: gift.badgeText ?? '',
    displayHeadline: gift.displayHeadline ?? ''
  };
}

function toRequest(form: FormState): CreateCartGiftRequest | string {
  const minSubtotal = Number(form.minSubtotal);
  const freeQty = Number(form.freeQty);
  if (!form.name.trim()) return 'Name is required.';
  if (!form.sku.trim()) return 'Choose a SKU.';
  if (!Number.isFinite(minSubtotal) || minSubtotal <= 0) return 'Minimum basket must be greater than 0.';
  if (!Number.isInteger(freeQty) || freeQty < 1) return 'Free quantity must be at least 1.';
  return {
    name: form.name.trim(),
    enabled: form.enabled,
    storeId: form.storeId,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    priority: form.priority,
    minSubtotal,
    sku: form.sku.trim(),
    freeQty,
    badgeText: form.badgeText.trim(),
    displayHeadline: form.displayHeadline.trim()
  };
}

export default function CartGiftsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<CartGift[] | null>(null);
  const [stores, setStores] = useState<Darkstore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CartGift | null>(null);
  const [editForm, setEditForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await cartGiftAdminApi.list());
    } catch (err) {
      setError(err instanceof CartGiftAdminApiError ? err.message : 'Failed to load cart gifts.');
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = toRequest(form);
    if (typeof body === 'string') {
      toast.push('error', body);
      return;
    }
    setCreating(true);
    try {
      await cartGiftAdminApi.create(body);
      setForm(BLANK);
      setShowCreate(false);
      toast.push('success', 'Cart gift created.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CartGiftAdminApiError ? err.message : 'Could not create cart gift.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body = toRequest(editForm);
    if (typeof body === 'string') {
      toast.push('error', body);
      return;
    }
    setSaving(true);
    try {
      await cartGiftAdminApi.patch(editing.id, {
        ...body,
        clearStoreId: editForm.storeId == null,
        clearStartsAt: editForm.startsAt == null,
        clearEndsAt: editForm.endsAt == null
      });
      setEditing(null);
      toast.push('success', 'Cart gift updated.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CartGiftAdminApiError ? err.message : 'Could not update cart gift.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(gift: CartGift) {
    setToggling(gift.id);
    try {
      await cartGiftAdminApi.patch(gift.id, { enabled: !gift.enabled });
      await load();
    } catch (err) {
      toast.push('error', err instanceof CartGiftAdminApiError ? err.message : 'Could not update cart gift.');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(gift: CartGift) {
    if (!confirm(`Delete cart gift “${gift.name}”?`)) return;
    setDeleting(gift.id);
    try {
      await cartGiftAdminApi.remove(gift.id);
      toast.push('success', 'Cart gift deleted.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CartGiftAdminApiError ? err.message : 'Could not delete cart gift.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cart gifts</h1>
          <p className="text-sm text-gray-500">
            A free quantity of one SKU when the paid basket reaches the minimum. The highest-priority
            enabled offer for the store is the only one checkout considers.
          </p>
        </div>
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" /> New cart gift
        </button>
      </div>

      {showCreate && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>New cart gift</SectionTitle>
            <button className="btn-ghost p-1" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <GiftForm form={form} setForm={setForm} stores={stores} onSubmit={handleCreate} submitting={creating} submitLabel="Create" />
        </Card>
      )}

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && rows === null ? (
          <div className="p-6">
            <Loading label="Loading cart gifts…" />
          </div>
        ) : rows && rows.length === 0 ? (
          <EmptyState>No cart gifts yet.</EmptyState>
        ) : rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Minimum</th>
                  <th className="px-4 py-3 font-medium">Gift</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                  <th className="px-4 py-3 font-medium">Enabled</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((gift) => (
                  <tr key={gift.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium">{gift.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{storeLabel(gift.storeId, stores)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">K {Number(gift.minSubtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {gift.freeQty} × {gift.sku}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtWindow(gift)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-0.5 text-xs"
                        disabled={toggling === gift.id}
                        onClick={() => handleToggle(gift)}
                      >
                        {toggling === gift.id ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          <Badge tone={gift.enabled ? 'green' : 'gray'}>{gift.enabled ? 'On' : 'Off'}</Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => {
                            setEditing(gift);
                            setEditForm(fromGift(gift));
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs text-red-600"
                          disabled={deleting === gift.id}
                          onClick={() => handleDelete(gift)}
                        >
                          {deleting === gift.id ? <Spinner className="h-3 w-3" /> : 'Delete'}
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
            <GiftForm
              form={editForm}
              setForm={setEditForm}
              stores={stores}
              onSubmit={handleSave}
              submitting={saving}
              submitLabel="Save"
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function GiftForm({
  form,
  setForm,
  stores,
  onSubmit,
  submitting,
  submitLabel
}: {
  form: FormState;
  setForm: (fn: FormState | ((current: FormState) => FormState)) => void;
  stores: Darkstore[];
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label">Name</span>
          <input className="input" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Store</span>
          <select
            className="input"
            value={form.storeId == null ? '' : String(form.storeId)}
            onChange={(e) => set({ storeId: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          >
            <option value="">All stores</option>
            {stores.map((store) => (
              <option key={store.darkstore_id} value={store.darkstore_id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="label">Minimum paid basket (K)</span>
          <input
            className="input"
            inputMode="decimal"
            required
            value={form.minSubtotal}
            onChange={(e) => set({ minSubtotal: e.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Free quantity</span>
          <input
            className="input"
            inputMode="numeric"
            required
            value={form.freeQty}
            onChange={(e) => set({ freeQty: e.target.value })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Starts</span>
          <input
            className="input"
            type="datetime-local"
            value={isoToCatInput(form.startsAt)}
            onChange={(e) => set({ startsAt: catInputToIso(e.target.value) })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Ends</span>
          <input
            className="input"
            type="datetime-local"
            value={isoToCatInput(form.endsAt)}
            onChange={(e) => set({ endsAt: catInputToIso(e.target.value) })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Priority</span>
          <input
            className="input"
            inputMode="numeric"
            value={String(form.priority)}
            onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span className="text-sm">Enabled</span>
        </label>
      </div>
      <SkuPicker label="Gift SKU" value={form.sku} onChange={(sku) => set({ sku })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label">Headline</span>
          <input
            className="input"
            value={form.displayHeadline}
            onChange={(e) => set({ displayHeadline: e.target.value })}
            placeholder="Free Pepsi on orders above K249"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Badge</span>
          <input className="input" value={form.badgeText} onChange={(e) => set({ badgeText: e.target.value })} placeholder="FREE" />
        </label>
      </div>
      <button className="btn-primary text-sm" type="submit" disabled={submitting}>
        {submitting ? <Spinner className="h-4 w-4" /> : submitLabel}
      </button>
    </form>
  );
}
