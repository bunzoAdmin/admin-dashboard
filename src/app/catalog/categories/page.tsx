'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { FolderTree, ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import { normalizeSingleImageKey, resolveCatalogImageUrl } from '@/lib/catalogImageUrl';
import type { CategoryTreeNode, CreateCategoryRequest, UpdateCategoryRequest } from '@/lib/catalogTypes';
import { slugifyCategoryName } from '@/lib/catalogTypes';
import {
  CategoryTree,
  categoryBreadcrumb,
  categoryDepth,
  findCategoryInTree,
  findParentCategory
} from '@/components/catalog/CategoryTree';
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

function categoryToForm(c: CategoryTreeNode): CategoryFormState {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    displayOrder: String(c.displayOrder ?? 0),
    isActive: c.isActive !== false,
    imageUrl: normalizeSingleImageKey(c.imageUrl),
    parentId: c.parentId ?? null
  };
}

function parentNameForId(tree: CategoryTreeNode[], parentId: number): string {
  const parent = findCategoryInTree(tree, parentId);
  return parent ? `${parent.name} · ID ${parent.id}` : `ID ${parentId}`;
}

export default function CategoriesPage() {
  const toast = useToast();
  const [tree, setTree] = useState<CategoryTreeNode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CategoryTreeNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryTreeNode | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const nextTree = await catalogApi.getCategoryTree();
      setTree(nextTree);
      setSelected((prev) => (prev ? findCategoryInTree(nextTree, prev.id) : null));
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load categories.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(parentId: number | null) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId, displayOrder: '0' });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(category: CategoryTreeNode) {
    setEditing(category);
    setForm(categoryToForm(category));
    setFormError(null);
    setModalOpen(true);
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const slug = form.slug.trim() || slugifyCategoryName(name);
    const displayOrder = parseInt(form.displayOrder, 10);
    if (!name || !slug) {
      setFormError('Name and slug are required.');
      return;
    }
    if (!Number.isFinite(displayOrder)) {
      setFormError('Display order must be a number.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        const body: UpdateCategoryRequest = {
          name,
          slug,
          description: form.description.trim() || undefined,
          displayOrder,
          isActive: form.isActive,
          imageUrl: normalizeSingleImageKey(form.imageUrl) || undefined
        };
        await catalogApi.updateCategory(editing.id, body);
        toast.push('success', `Category "${name}" updated.`);
      } else {
        const body: CreateCategoryRequest = {
          name,
          slug,
          description: form.description.trim() || undefined,
          parentId: form.parentId ?? undefined,
          displayOrder,
          isActive: form.isActive,
          imageUrl: normalizeSingleImageKey(form.imageUrl) || undefined
        };
        await catalogApi.createCategory(body);
        toast.push('success', `Category "${name}" created.`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof CatalogApiError
          ? err.message
          : editing
            ? 'Failed to update category.'
            : 'Failed to create category.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: CategoryTreeNode) {
    const hasChildren = (category.children?.length ?? 0) > 0;
    if (hasChildren) {
      toast.push('error', `"${category.name}" has subcategories. Remove them before deleting this category.`);
      return;
    }
    if (!confirm(`Delete category "${category.name}"? This fails if products are still assigned to it.`)) return;

    setBusy(true);
    try {
      await catalogApi.deleteCategory(category.id);
      toast.push('success', `Category "${category.name}" deleted.`);
      if (selected?.id === category.id) setSelected(null);
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to delete category.');
    } finally {
      setBusy(false);
    }
  }

  const modalTitle = editing
    ? 'Edit category'
    : form.parentId != null
      ? 'Add subcategory'
      : 'Add root category';

  const selectedImageKey = selected ? normalizeSingleImageKey(selected.imageUrl) : '';
  const selectedImageUrl = selectedImageKey ? resolveCatalogImageUrl(selectedImageKey) : null;
  const selectedBreadcrumb = selected && tree ? categoryBreadcrumb(tree, selected.id) : [];
  const selectedParent = selected && tree ? findParentCategory(tree, selected.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">
            L1 → L2 → L3 hierarchy. Assign products to leaf (L3) categories. Use the tree chevrons to expand or
            collapse branches.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => openCreate(null)}>
          <Plus className="h-4 w-4" /> Add root category
        </button>
      </div>

      {loadError && <ErrorBox message={loadError} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Category tree</h2>
          </div>
          {tree === null && !loadError ? (
            <Loading label="Loading categories…" />
          ) : tree && tree.length === 0 ? (
            <EmptyState>No categories yet. Add a root category to get started.</EmptyState>
          ) : tree ? (
            <CategoryTree
              nodes={tree}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              showToolbar
              className="max-h-[min(28rem,calc(100vh-14rem))] overflow-y-auto pr-1"
            />
          ) : null}
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Details</h2>
          {!selected ? (
            <EmptyState>Select a category from the tree to view and edit it.</EmptyState>
          ) : (
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {selectedImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={selectedImageUrl} alt={selected.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-gray-300">
                      <ImageIcon className="h-6 w-6" />
                      <span className="mt-1 text-[10px]">No image</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                    <Badge tone={selected.isActive ? 'green' : 'gray'}>{selected.isActive ? 'Active' : 'Inactive'}</Badge>
                    {tree && <Badge tone="gray">L{categoryDepth(tree, selected.id) ?? '?'}</Badge>}
                  </div>
                  <p className="font-mono text-xs text-gray-400">{selected.slug}</p>
                  {selectedBreadcrumb.length > 1 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedBreadcrumb.map((n) => n.name).join(' › ')}
                    </p>
                  )}
                </div>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail label="Category ID" value={String(selected.id)} mono />
                <Detail
                  label="Parent"
                  value={
                    selectedParent ? (
                      <button
                        type="button"
                        className="text-left text-brand-green hover:underline"
                        onClick={() => setSelected(selectedParent)}
                      >
                        {selectedParent.name}
                        <span className="ml-1 font-mono text-xs text-gray-400">#{selectedParent.id}</span>
                      </button>
                    ) : (
                      'Root category'
                    )
                  }
                />
                <Detail label="Display order" value={String(selected.displayOrder)} />
                <Detail label="Subcategories" value={String(selected.children?.length ?? 0)} />
                {selected.description && (
                  <div className="sm:col-span-2">
                    <Detail label="Description" value={selected.description} />
                  </div>
                )}
                {selectedImageKey && (
                  <div className="sm:col-span-2">
                    <Detail label="Image key" value={selectedImageKey} mono />
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <button type="button" className="btn-primary" onClick={() => openEdit(selected)} disabled={busy}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button type="button" className="btn-ghost" onClick={() => openCreate(selected.id)} disabled={busy}>
                  <Plus className="h-4 w-4" /> Add subcategory
                </button>
                <button
                  type="button"
                  className="btn-ghost text-red-600 hover:bg-red-50"
                  onClick={() => removeCategory(selected)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        <form onSubmit={submitCategory} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {formError && <ErrorBox message={formError} />}
            {editing && (
              <p className="text-sm text-gray-500">
                Editing <span className="font-medium text-gray-700">{editing.name}</span>
                <span className="font-mono text-xs text-gray-400"> · #{editing.id}</span>
              </p>
            )}
            {!editing && form.parentId != null && tree && (
              <p className="text-sm text-gray-500">
                Parent: <span className="font-medium text-gray-700">{parentNameForId(tree, form.parentId)}</span>
              </p>
            )}
            {!editing && form.parentId == null && (
              <p className="text-sm text-gray-500">Creating a root-level category (no parent).</p>
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
                    slug: editing ? f.slug : f.slug || slugifyCategoryName(name)
                  }));
                }}
                autoFocus
              />
            </Field>
            <Field label="Slug" hint="URL-friendly identifier. Auto-suggested from name when creating.">
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
              hint="Upload stores one R2 key under categories/{slug}/. Replace uploads a new cache-busted key."
              value={form.imageUrl}
              onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Active (visible to customers)
            </label>
          </div>
          <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className={clsx('mt-0.5 text-gray-800', mono && 'font-mono text-xs break-all')}>{value}</dd>
    </div>
  );
}
