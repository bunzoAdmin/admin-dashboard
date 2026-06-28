'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { CategoryTreeNode, CreateCategoryRequest } from '@/lib/catalogTypes';
import { slugifyCategoryName } from '@/lib/catalogTypes';
import { CategoryTree, categoryDepth } from '@/components/catalog/CategoryTree';
import { ImageUploadField } from '@/components/catalog/ImageUploadField';
import { Modal } from '@/components/Modal';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

interface CategoryFormState {
  name: string;
  slug: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
  imageUrl: string;
  parentId: number | null;
}

const EMPTY_FORM: CategoryFormState = {
  name: '',
  slug: '',
  description: '',
  displayOrder: '0',
  isActive: true,
  imageUrl: '',
  parentId: null
};

export default function CategoriesPage() {
  const toast = useToast();
  const [tree, setTree] = useState<CategoryTreeNode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CategoryTreeNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setTree(await catalogApi.getCategoryTree());
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load categories.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(parentId: number | null) {
    setForm({ ...EMPTY_FORM, parentId, displayOrder: '0' });
    setFormError(null);
    setModalOpen(true);
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const slug = (form.slug.trim() || slugifyCategoryName(name));
    const displayOrder = parseInt(form.displayOrder, 10);
    if (!name || !slug) {
      setFormError('Name and slug are required.');
      return;
    }
    if (!Number.isFinite(displayOrder)) {
      setFormError('Display order must be a number.');
      return;
    }

    const body: CreateCategoryRequest = {
      name,
      slug,
      description: form.description.trim() || undefined,
      parentId: form.parentId ?? undefined,
      displayOrder,
      isActive: form.isActive,
      imageUrl: form.imageUrl.trim() || undefined
    };

    setBusy(true);
    setFormError(null);
    try {
      await catalogApi.createCategory(body);
      toast.push('success', `Category "${name}" created.`);
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof CatalogApiError ? err.message : 'Failed to create category.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">
            Three-level tree like Blinkit: L1 (Grocery &amp; Kitchen) → L2 (Fresh Fruits &amp; Vegetables) → L3 (Fresh Fruits, Exotic Fruits…).
            Assign products to L3 leaf categories.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => openCreate(null)}>
          <Plus className="h-4 w-4" /> Add root category
        </button>
      </div>

      {loadError && <ErrorBox message={loadError} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Tree</h2>
          {tree === null && !loadError ? (
            <Loading label="Loading categories…" />
          ) : tree && tree.length === 0 ? (
            <EmptyState>No categories yet. Add a root category to get started.</EmptyState>
          ) : tree ? (
            <CategoryTree nodes={tree} selectedId={selected?.id ?? null} onSelect={setSelected} />
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Details</h2>
          {!selected ? (
            <p className="text-sm text-gray-400">Select a category from the tree to view details.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                  <Badge tone={selected.isActive ? 'green' : 'gray'}>{selected.isActive ? 'active' : 'inactive'}</Badge>
                  {tree && (
                    <Badge tone="gray">Level {categoryDepth(tree, selected.id) ?? '?'}</Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-gray-400">{selected.slug}</p>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="ID" value={String(selected.id)} mono />
                <Row label="Parent ID" value={selected.parentId != null ? String(selected.parentId) : '— (root)'} mono />
                <Row label="Display order" value={String(selected.displayOrder)} />
                {selected.description && <Row label="Description" value={selected.description} />}
                {selected.imageUrl && <Row label="Image URL" value={selected.imageUrl} />}
              </dl>
              <button type="button" className="btn-ghost" onClick={() => openCreate(selected.id)}>
                <Plus className="h-4 w-4" /> Add subcategory
              </button>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.parentId != null ? 'Add subcategory' : 'Add root category'}
      >
        <form onSubmit={submitCategory} className="space-y-4">
          {formError && <ErrorBox message={formError} />}
          {form.parentId != null && (
            <p className="text-sm text-gray-500">Parent category ID: <span className="font-mono">{form.parentId}</span></p>
          )}
          <Field label="Name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  slug: f.slug || slugifyCategoryName(name)
                }));
              }}
              autoFocus
            />
          </Field>
          <Field label="Slug" hint="URL-friendly identifier. Auto-suggested from name.">
            <input className="input font-mono" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Display order">
            <input className="input" type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))} />
          </Field>
          <ImageUploadField
            scope="category"
            slug={form.slug.trim() || slugifyCategoryName(form.name)}
            label="Image"
            hint="Upload stores categories/{slug}/original.jpg in R2. The returned r2Key is saved as imageUrl."
            value={form.imageUrl}
            onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Active (visible to customers)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Create category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-gray-400">{label}</dt>
      <dd className={mono ? 'font-mono text-xs text-gray-800 break-all' : 'text-gray-800'}>{value}</dd>
    </div>
  );
}
