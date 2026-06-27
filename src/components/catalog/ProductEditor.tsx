'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type {
  BadgeResponse,
  CategoryTreeNode,
  ContentUom,
  NutritionRowDto,
  ProductDetailsDto,
  ProductResponse,
  ProductSyncItem,
  TemperatureBand
} from '@/lib/catalogTypes';
import { CONTENT_UOM_OPTIONS } from '@/lib/catalogTypes';
import { flattenCategoryTree } from '@/components/catalog/CategoryTree';
import { PdpDetailsPanel } from '@/components/catalog/PdpDetailsPanel';
import { Badge, Card, ErrorBox, Field, Spinner, useToast } from '@/components/ui';

export type ProductEditorMode = 'create' | 'edit';

type EditorTab = 'basics' | 'merchandising' | 'search' | 'badges' | 'pdp';

export interface ProductFormState {
  name: string;
  brand: string;
  categoryId: string;
  basePrice: string;
  contentAmount: string;
  contentUom: ContentUom;
  multipackCount: string;
  description: string;
  shortDescription: string;
  slug: string;
  images: string;
  tags: string;
  weightGrams: string;
  groupId: string;
  isActive: boolean;
  searchKeywords: string;
  searchPriority: string;
  isBestseller: boolean;
  badgeCodes: string[];
  detailsAbout: string;
  storageInstructions: string;
  storageShelfLife: string;
  storageTemperatureBand: TemperatureBand | '';
  nutritionServingSize: string;
  nutritionRows: NutritionRowDto[];
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  brand: '',
  categoryId: '',
  basePrice: '',
  contentAmount: '',
  contentUom: 'ML',
  multipackCount: '1',
  description: '',
  shortDescription: '',
  slug: '',
  images: '',
  tags: '',
  weightGrams: '',
  groupId: '',
  isActive: true,
  searchKeywords: '',
  searchPriority: '0',
  isBestseller: false,
  badgeCodes: [],
  detailsAbout: '',
  storageInstructions: '',
  storageShelfLife: '',
  storageTemperatureBand: '',
  nutritionServingSize: '',
  nutritionRows: []
};

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'merchandising', label: 'Merchandising' },
  { id: 'search', label: 'Search' },
  { id: 'badges', label: 'Badges' },
  { id: 'pdp', label: 'PDP details' }
];

function productToForm(p: ProductResponse): ProductFormState {
  const rows = p.details?.nutrition?.rows?.length
    ? p.details.nutrition.rows.map((r) => ({ ...r }))
    : [];
  return {
    name: p.name ?? '',
    brand: p.brand ?? '',
    categoryId: p.categoryId != null ? String(p.categoryId) : '',
    basePrice: p.basePrice != null ? String(p.basePrice) : '',
    contentAmount: p.content?.amount != null ? String(p.content.amount) : '',
    contentUom: (p.content?.uom as ContentUom) ?? 'ML',
    multipackCount: p.content?.multipackCount != null ? String(p.content.multipackCount) : '1',
    description: p.description ?? '',
    shortDescription: p.shortDescription ?? '',
    slug: p.slug ?? '',
    images: p.images?.join(', ') ?? '',
    tags: p.tags ?? '',
    weightGrams: p.weightGrams != null ? String(p.weightGrams) : '',
    groupId: p.groupId ?? '',
    isActive: p.isActive !== false,
    searchKeywords: p.searchKeywords ?? '',
    searchPriority: p.searchPriority != null ? String(p.searchPriority) : '0',
    isBestseller: p.isBestseller === true,
    badgeCodes: p.badges?.map((b) => b.code) ?? [],
    detailsAbout: p.details?.about ?? '',
    storageInstructions: p.details?.storage?.instructions ?? '',
    storageShelfLife: p.details?.storage?.shelfLife ?? '',
    storageTemperatureBand: (p.details?.storage?.temperatureBand as TemperatureBand) ?? '',
    nutritionServingSize: p.details?.nutrition?.servingSize ?? '',
    nutritionRows: rows
  };
}

function buildDetails(form: ProductFormState): ProductDetailsDto | null | undefined {
  const about = form.detailsAbout.trim() || undefined;
  const storageInstructions = form.storageInstructions.trim() || undefined;
  const storageShelfLife = form.storageShelfLife.trim() || undefined;
  const temperatureBand = form.storageTemperatureBand || undefined;
  const servingSize = form.nutritionServingSize.trim() || undefined;
  const rows = form.nutritionRows
    .map((r) => ({
      nutrient: r.nutrient.trim(),
      value: r.value.trim(),
      unit: r.unit?.trim() || undefined
    }))
    .filter((r) => r.nutrient && r.value);

  const hasStorage = storageInstructions || storageShelfLife || temperatureBand;
  const hasNutrition = servingSize || rows.length > 0;
  const hasAny = about || hasStorage || hasNutrition;

  if (!hasAny) return null;

  return {
    version: 1,
    about,
    storage: hasStorage
      ? { instructions: storageInstructions, shelfLife: storageShelfLife, temperatureBand }
      : undefined,
    nutrition: hasNutrition ? { servingSize, rows: rows.length > 0 ? rows : undefined } : undefined
  };
}

interface ProductEditorProps {
  mode: ProductEditorMode;
  barcode: string;
  product: ProductResponse | null;
  categories: CategoryTreeNode[];
  onSaved: () => void;
  onCancel: () => void;
}

export function ProductEditor({ mode, barcode, product, categories, onSaved, onCancel }: ProductEditorProps) {
  const toast = useToast();
  const [tab, setTab] = useState<EditorTab>('basics');
  const [form, setForm] = useState<ProductFormState>(() => (product ? productToForm(product) : EMPTY_FORM));
  const [allBadges, setAllBadges] = useState<BadgeResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(product ? productToForm(product) : EMPTY_FORM);
    setError(null);
    setTab('basics');
  }, [product, mode, barcode]);

  useEffect(() => {
    catalogApi.listBadges(false).then(setAllBadges).catch(() => setAllBadges([]));
  }, []);

  const categoryOptions = flattenCategoryTree(categories);

  const toggleBadge = useCallback((code: string) => {
    setForm((f) => {
      const has = f.badgeCodes.includes(code);
      return {
        ...f,
        badgeCodes: has ? f.badgeCodes.filter((c) => c !== code) : [...f.badgeCodes, code]
      };
    });
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = form.name.trim();
      const categoryId = parseInt(form.categoryId, 10);
      const basePrice = parseFloat(form.basePrice);
      const contentAmount = parseFloat(form.contentAmount);
      const multipackCount = parseInt(form.multipackCount, 10) || 1;
      const searchPriority = parseInt(form.searchPriority, 10);
      const weightGrams = form.weightGrams.trim() ? parseInt(form.weightGrams, 10) : undefined;

      if (!name || !Number.isFinite(categoryId) || !Number.isFinite(basePrice) || basePrice <= 0) {
        setError('Name, category, and a valid price are required.');
        setTab('basics');
        return;
      }
      if (!Number.isFinite(contentAmount) || contentAmount <= 0) {
        setError('Content amount must be greater than zero.');
        setTab('basics');
        return;
      }

      const images = form.images
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const item: ProductSyncItem = {
        name,
        categoryId,
        basePrice,
        content: { amount: contentAmount, uom: form.contentUom, multipackCount },
        barcode: barcode.trim(),
        brand: form.brand.trim() || undefined,
        description: form.description.trim() || undefined,
        shortDescription: form.shortDescription.trim() || undefined,
        slug: form.slug.trim() || undefined,
        images: images.length > 0 ? images : undefined,
        tags: form.tags.trim() || undefined,
        weightGrams: Number.isFinite(weightGrams) ? weightGrams : undefined,
        groupId: form.groupId.trim() || undefined,
        isActive: form.isActive,
        searchKeywords: form.searchKeywords.trim() || undefined,
        searchPriority: Number.isFinite(searchPriority) ? searchPriority : 0,
        isBestseller: form.isBestseller,
        badgeCodes: form.badgeCodes,
        details: buildDetails(form) ?? undefined
      };

      if (mode === 'edit' && product?.id) {
        item.productId = product.id;
      }

      setBusy(true);
      setError(null);
      try {
        const res = await catalogApi.syncProducts({ items: [item] });
        const result = res.results?.[0];
        if (result?.status !== 'SUCCESS') {
          setError(result?.errorMessage ?? 'Sync failed.');
          return;
        }
        toast.push('success', mode === 'edit' ? 'Product updated.' : 'Product created.');
        onSaved();
      } catch (err) {
        setError(err instanceof CatalogApiError ? err.message : 'Failed to save product.');
      } finally {
        setBusy(false);
      }
    },
    [form, barcode, mode, product, toast, onSaved]
  );

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={mode === 'edit' ? 'blue' : 'green'}>
          {mode === 'edit' ? 'Existing product — editing' : 'New product — fill in details'}
        </Badge>
        {mode === 'edit' && product?.sku && (
          <span className="font-mono text-xs text-gray-400">SKU: {product.sku}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === t.id ? 'bg-brand-green-light text-brand-green-dark' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}

      <form onSubmit={submit} className="space-y-4">
        {tab === 'basics' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Barcode" hint="Set by scan — not editable.">
                <input className="input input-readonly font-mono" value={barcode} readOnly />
              </Field>
              {mode === 'edit' && product?.sku && (
                <Field label="SKU" hint="Immutable after creation.">
                  <input className="input input-readonly font-mono" value={product.sku} readOnly />
                </Field>
              )}
            </div>
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" hint="Assign to a level-3 leaf category when possible.">
                <select
                  className="input"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  <option value="">Select category…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brand">
                <input className="input" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Base price (ZMW)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.basePrice}
                  onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Content amount">
                <input
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  value={form.contentAmount}
                  onChange={(e) => setForm((f) => ({ ...f, contentAmount: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Unit">
                <select
                  className="input"
                  value={form.contentUom}
                  onChange={(e) => setForm((f) => ({ ...f, contentUom: e.target.value as ContentUom }))}
                >
                  {CONTENT_UOM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Multipack count" hint="1 for single item; &gt;1 for multipacks.">
              <input
                className="input w-32"
                type="number"
                min="1"
                value={form.multipackCount}
                onChange={(e) => setForm((f) => ({ ...f, multipackCount: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Active (available in catalog)
            </label>
          </>
        )}

        {tab === 'merchandising' && (
          <>
            <Field label="Short description">
              <input className="input" value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Slug" hint="Optional URL slug.">
                <input className="input font-mono" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </Field>
              <Field label="Variant group ID" hint="Groups size variants on PDP. Auto-generated if blank.">
                <input className="input font-mono" value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))} />
              </Field>
            </div>
            <Field label="Images" hint="Comma-separated image URLs.">
              <input className="input" value={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tags" hint="Comma-separated merchandising tags.">
                <input className="input" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
              </Field>
              <Field label="Weight (grams)">
                <input className="input" type="number" min="0" value={form.weightGrams} onChange={(e) => setForm((f) => ({ ...f, weightGrams: e.target.value }))} />
              </Field>
            </div>
          </>
        )}

        {tab === 'search' && (
          <>
            <Field label="Search keywords" hint="Extra terms customers might search (comma-separated).">
              <input className="input" value={form.searchKeywords} onChange={(e) => setForm((f) => ({ ...f, searchKeywords: e.target.value }))} />
            </Field>
            <Field label="Search priority" hint="Higher values rank earlier in search (default 0).">
              <input className="input w-32" type="number" value={form.searchPriority} onChange={(e) => setForm((f) => ({ ...f, searchPriority: e.target.value }))} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isBestseller} onChange={(e) => setForm((f) => ({ ...f, isBestseller: e.target.checked }))} />
              Mark as bestseller
            </label>
          </>
        )}

        {tab === 'badges' && (
          <>
            {allBadges.length === 0 ? (
              <p className="text-sm text-gray-500">
                No active badges. Create them under Catalog → Badges first.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {allBadges.map((b) => {
                  const checked = form.badgeCodes.includes(b.code);
                  return (
                    <label
                      key={b.code}
                      className={clsx(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition',
                        checked ? 'border-brand-green bg-brand-green-light/50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleBadge(b.code)} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">{b.label}</span>
                        <span className="font-mono text-xs text-gray-400">
                          {b.code} · {b.category}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'pdp' && <PdpDetailsPanel form={form} setForm={setForm} />}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : mode === 'edit' ? 'Save changes' : 'Create product'}
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Clear
          </button>
        </div>
      </form>
    </Card>
  );
}

export { EMPTY_FORM, productToForm };
