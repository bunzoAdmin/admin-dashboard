'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  SectionTitle,
  Spinner,
  useToast
} from '@/components/ui';
import { useAuth } from '@/lib/store';
import { SkuPicker } from '@/components/zra/SkuPicker';
import {
  zraApi,
  ZraApiError,
  type ZraCategoryMapping,
  type ZraSkuMapping
} from '@/lib/zraApi';

export default function ZraMappingPage() {
  const toast = useToast();
  const user = useAuth((s) => s.user);

  const [skuQ, setSkuQ] = useState('');
  const [skuRows, setSkuRows] = useState<ZraSkuMapping[] | null>(null);
  const [skuLoading, setSkuLoading] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);

  const [skuForm, setSkuForm] = useState({ sku: '', taxTyCd: 'A', itemClsCd: '', notes: '' });
  const [skuSaving, setSkuSaving] = useState(false);

  const [categories, setCategories] = useState<ZraCategoryMapping[] | null>(null);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ categoryId: '', taxTyCd: 'A', itemClsCd: '', notes: '' });
  const [catSaving, setCatSaving] = useState(false);

  const loadSkus = useCallback(async (q?: string) => {
    setSkuLoading(true);
    setSkuError(null);
    try {
      setSkuRows(await zraApi.listSkuMappings({ q: q || undefined, page: 0, size: 50 }));
    } catch (err) {
      setSkuError(err instanceof ZraApiError ? err.message : 'Failed to load SKU mappings.');
    } finally {
      setSkuLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      setCategories(await zraApi.listCategoryMappings());
    } catch (err) {
      setCatError(err instanceof ZraApiError ? err.message : 'Failed to load category mappings.');
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkus();
    loadCategories();
  }, [loadSkus, loadCategories]);

  async function saveSku(e: React.FormEvent) {
    e.preventDefault();
    if (!skuForm.sku.trim()) return;
    setSkuSaving(true);
    try {
      await zraApi.upsertSkuMapping(
        skuForm.sku.trim(),
        {
          taxTyCd: skuForm.taxTyCd.trim() || undefined,
          itemClsCd: skuForm.itemClsCd.trim() || undefined,
          notes: skuForm.notes.trim() || undefined,
          active: true
        },
        user?.username
      );
      toast.push('success', `SKU mapping saved for ${skuForm.sku.trim()}.`);
      setSkuForm({ sku: '', taxTyCd: 'A', itemClsCd: '', notes: '' });
      await loadSkus(skuQ);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Failed to save SKU mapping.');
    } finally {
      setSkuSaving(false);
    }
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    const categoryId = Number(catForm.categoryId);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      toast.push('error', 'Enter a valid category ID.');
      return;
    }
    setCatSaving(true);
    try {
      await zraApi.upsertCategoryMapping(
        categoryId,
        {
          taxTyCd: catForm.taxTyCd.trim() || undefined,
          itemClsCd: catForm.itemClsCd.trim() || undefined,
          notes: catForm.notes.trim() || undefined
        },
        user?.username
      );
      toast.push('success', `Category mapping saved for ${categoryId}.`);
      setCatForm({ categoryId: '', taxTyCd: 'A', itemClsCd: '', notes: '' });
      await loadCategories();
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Failed to save category mapping.');
    } finally {
      setCatSaving(false);
    }
  }

  function editSku(row: ZraSkuMapping) {
    setSkuForm({
      sku: row.sku,
      taxTyCd: row.taxTyCd ?? 'A',
      itemClsCd: row.itemClsCd ?? '',
      notes: row.notes ?? ''
    });
  }

  function editCategory(row: ZraCategoryMapping) {
    setCatForm({
      categoryId: String(row.categoryId),
      taxTyCd: row.taxTyCd ?? 'A',
      itemClsCd: row.itemClsCd ?? '',
      notes: row.notes ?? ''
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ZRA Mapping</h1>
        <p className="text-sm text-gray-500">Map SKUs and catalog categories to ZRA tax / item classification codes.</p>
      </div>

      <Card>
        <SectionTitle>SKU mapping</SectionTitle>
        <form onSubmit={saveSku} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SkuPicker
            value={skuForm.sku}
            onChange={(sku) => setSkuForm((f) => ({ ...f, sku }))}
          />
          <Field label="taxTyCd">
            <input
              className="input font-mono"
              value={skuForm.taxTyCd}
              onChange={(e) => setSkuForm((f) => ({ ...f, taxTyCd: e.target.value }))}
              placeholder="A"
            />
          </Field>
          <Field label="itemClsCd">
            <input
              className="input font-mono"
              value={skuForm.itemClsCd}
              onChange={(e) => setSkuForm((f) => ({ ...f, itemClsCd: e.target.value }))}
              required
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={skuForm.notes}
              onChange={(e) => setSkuForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={skuSaving}>
              {skuSaving ? <Spinner className="h-4 w-4" /> : 'Upsert SKU'}
            </button>
          </div>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadSkus(skuQ);
          }}
          className="mb-3 flex flex-wrap items-end gap-2"
        >
          <Field label="Search SKUs" className="min-w-[220px] flex-1">
            <input
              className="input"
              value={skuQ}
              onChange={(e) => setSkuQ(e.target.value)}
              placeholder="SKU contains…"
            />
          </Field>
          <button type="submit" className="btn-ghost" disabled={skuLoading}>
            Search
          </button>
        </form>

        {skuError && <ErrorBox message={skuError} />}
        {skuLoading && skuRows == null ? (
          <Loading label="Loading SKU mappings…" />
        ) : !skuRows || skuRows.length === 0 ? (
          <EmptyState>No SKU mappings found.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">taxTyCd</th>
                  <th className="px-3 py-2 font-medium">itemClsCd</th>
                  <th className="px-3 py-2 font-medium">Active</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {skuRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.taxTyCd}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.itemClsCd}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Yes' : 'No'}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => editSku(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Category mapping</SectionTitle>
        <form onSubmit={saveCategory} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Category ID">
            <input
              className="input font-mono"
              type="number"
              min={1}
              value={catForm.categoryId}
              onChange={(e) => setCatForm((f) => ({ ...f, categoryId: e.target.value }))}
              required
            />
          </Field>
          <Field label="taxTyCd">
            <input
              className="input font-mono"
              value={catForm.taxTyCd}
              onChange={(e) => setCatForm((f) => ({ ...f, taxTyCd: e.target.value }))}
            />
          </Field>
          <Field label="itemClsCd">
            <input
              className="input font-mono"
              value={catForm.itemClsCd}
              onChange={(e) => setCatForm((f) => ({ ...f, itemClsCd: e.target.value }))}
              required
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={catForm.notes}
              onChange={(e) => setCatForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={catSaving}>
              {catSaving ? <Spinner className="h-4 w-4" /> : 'Upsert category'}
            </button>
          </div>
        </form>

        {catError && <ErrorBox message={catError} />}
        {catLoading && categories == null ? (
          <Loading label="Loading category mappings…" />
        ) : !categories || categories.length === 0 ? (
          <EmptyState>No category mappings yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 font-medium">Category ID</th>
                  <th className="px-3 py-2 font-medium">taxTyCd</th>
                  <th className="px-3 py-2 font-medium">itemClsCd</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {categories.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.categoryId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.taxTyCd}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.itemClsCd}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-xs text-gray-500">{r.notes ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => editCategory(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
