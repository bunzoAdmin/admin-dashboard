'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { BadgeCategory, BadgeResponse, CreateBadgeRequest, UpdateBadgeRequest } from '@/lib/catalogTypes';
import { BADGE_CATEGORY_OPTIONS } from '@/lib/catalogTypes';
import { Modal } from '@/components/Modal';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

interface BadgeFormState {
  code: string;
  label: string;
  category: BadgeCategory;
  iconKey: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: BadgeFormState = {
  code: '',
  label: '',
  category: 'CLAIM',
  iconKey: '',
  sortOrder: '0',
  isActive: true
};

function badgeToForm(b: BadgeResponse): BadgeFormState {
  return {
    code: b.code,
    label: b.label,
    category: b.category,
    iconKey: b.iconKey,
    sortOrder: String(b.sortOrder ?? 0),
    isActive: b.isActive !== false
  };
}

export default function BadgesPage() {
  const toast = useToast();
  const [badges, setBadges] = useState<BadgeResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BadgeResponse | null>(null);
  const [form, setForm] = useState<BadgeFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setBadges(await catalogApi.listBadges(true));
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load badges.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(b: BadgeResponse) {
    setEditing(b);
    setForm(badgeToForm(b));
    setFormError(null);
    setModalOpen(true);
  }

  async function submitBadge(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const label = form.label.trim();
    const iconKey = form.iconKey.trim();
    const sortOrder = parseInt(form.sortOrder, 10);

    if (!code || !label || !iconKey) {
      setFormError('Code, label, and icon key are required.');
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
      setFormError('Code must be UPPER_SNAKE_CASE (e.g. ORGANIC, KEEP_COLD).');
      return;
    }
    if (!Number.isFinite(sortOrder)) {
      setFormError('Sort order must be a number.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        const body: UpdateBadgeRequest = {
          label,
          category: form.category,
          iconKey,
          sortOrder,
          isActive: form.isActive
        };
        if (code !== editing.code) body.code = code;
        await catalogApi.updateBadge(editing.code, body);
        toast.push('success', `Badge "${label}" updated.`);
      } else {
        const body: CreateBadgeRequest = { code, label, category: form.category, iconKey, sortOrder };
        await catalogApi.createBadge(body);
        toast.push('success', `Badge "${label}" created.`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof CatalogApiError ? err.message : 'Failed to save badge.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product badges</h1>
          <p className="text-sm text-gray-500">
            Define claim, handling, and diet badges — then attach them to products when scanning or editing.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add badge
        </button>
      </div>

      {loadError && <ErrorBox message={loadError} />}

      <Card className="overflow-hidden p-0">
        {badges === null && !loadError ? (
          <div className="p-6">
            <Loading label="Loading badges…" />
          </div>
        ) : badges && badges.length === 0 ? (
          <EmptyState>No badges yet. Create badges here, then link them on the Products page.</EmptyState>
        ) : badges ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Label</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Icon</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {badges.map((b) => (
                  <tr key={b.code} className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-mono text-xs">{b.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{b.label}</td>
                    <td className="px-4 py-3 text-gray-600">{b.category}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.iconKey}</td>
                    <td className="px-4 py-3 text-gray-600">{b.sortOrder}</td>
                    <td className="px-4 py-3">
                      <Badge tone={b.isActive ? 'green' : 'gray'}>{b.isActive ? 'active' : 'inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="text-sm text-brand-green hover:underline" onClick={() => openEdit(b)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <p className="text-sm text-gray-500">
        Link badges to products from{' '}
        <Link href="/catalog/products" className="text-brand-green hover:underline">
          Catalog → Products
        </Link>
        .
      </p>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit badge' : 'Add badge'}>
        <form onSubmit={submitBadge} className="space-y-4">
          {formError && <ErrorBox message={formError} />}
          <Field label="Code" hint="UPPER_SNAKE_CASE. Immutable after creation unless you rename via edit.">
            <input
              className="input font-mono uppercase"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              disabled={!!editing}
              autoFocus={!editing}
            />
          </Field>
          <Field label="Label">
            <input className="input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </Field>
          <Field label="Category">
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as BadgeCategory }))}
            >
              {BADGE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Icon key" hint="App icon identifier (e.g. leaf, snowflake).">
            <input className="input font-mono" value={form.iconKey} onChange={(e) => setForm((f) => ({ ...f, iconKey: e.target.value }))} />
          </Field>
          <Field label="Sort order">
            <input className="input w-32" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
          </Field>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Active (can be linked to products)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create badge'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
