'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type {
  CategoryShowcaseGroupResponse,
  CategoryShowcaseTypeOption,
  CreateCategoryShowcaseGroupRequest,
  UpdateCategoryShowcaseGroupRequest
} from '@/lib/catalogTypes';
import {
  CATEGORY_SHOWCASE_TYPE_FALLBACKS,
  categoryShowcaseTypeLabel,
  normalizeCategoryShowcaseType,
  slugifyBannerName
} from '@/lib/catalogTypes';
import { ErrorBox, Field, Spinner } from '@/components/ui';

interface FormState {
  name: string;
  slug: string;
  type: string;
  displayTitle: string;
  subtitle: string;
  priority: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  type: 'FEATURED',
  displayTitle: '',
  subtitle: '',
  priority: '0',
  isActive: true
};

function groupToForm(g: CategoryShowcaseGroupResponse): FormState {
  return {
    name: g.name,
    slug: g.slug,
    type: g.type,
    displayTitle: g.displayTitle ?? '',
    subtitle: g.subtitle ?? '',
    priority: String(g.priority ?? 0),
    isActive: g.isActive
  };
}

interface CategoryShowcaseGroupFormProps {
  editing?: CategoryShowcaseGroupResponse;
  stayOnPage?: boolean;
  onSaved?: (group: CategoryShowcaseGroupResponse) => void;
}

export function CategoryShowcaseGroupForm({ editing, stayOnPage, onSaved }: CategoryShowcaseGroupFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(editing ? groupToForm(editing) : EMPTY_FORM);
  const [typeOptions, setTypeOptions] = useState<CategoryShowcaseTypeOption[]>(CATEGORY_SHOWCASE_TYPE_FALLBACKS);
  const [typesLoading, setTypesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogApi.listCategoryShowcaseTypes()
      .then((types) => { if (types.length > 0) setTypeOptions(types); })
      .catch(() => {})
      .finally(() => setTypesLoading(false));
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const name = form.name.trim();
    const slug = form.slug.trim() || slugifyBannerName(name);
    const type = normalizeCategoryShowcaseType(form.type);
    const priority = Number(form.priority);

    if (!name) { setError('Name is required.'); return; }
    if (!slug) { setError('Slug is required.'); return; }
    if (!type) { setError('Type is required.'); return; }
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(type)) {
      setError('Type must use uppercase letters, digits, and underscores (e.g. FEATURED, SHOP_BY).');
      return;
    }
    if (Number.isNaN(priority)) { setError('Priority must be a number.'); return; }

    setBusy(true);
    setError(null);

    try {
      if (editing) {
        const body: UpdateCategoryShowcaseGroupRequest = {
          name, slug, type,
          displayTitle: form.displayTitle.trim() || undefined,
          subtitle: form.subtitle.trim() || undefined,
          priority, isActive: form.isActive
        };
        const saved = await catalogApi.updateCategoryShowcaseGroup(editing.id, body);
        onSaved?.(saved);
        if (!stayOnPage) router.push('/catalog/category-showcases');
      } else {
        const body: CreateCategoryShowcaseGroupRequest = {
          name, slug, type,
          displayTitle: form.displayTitle.trim() || undefined,
          subtitle: form.subtitle.trim() || undefined,
          priority, isActive: form.isActive
        };
        const created = await catalogApi.createCategoryShowcaseGroup(body);
        router.push(`/catalog/category-showcases/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Failed to save category showcase group.');
    } finally {
      setBusy(false);
    }
  }

  const datalistId = 'category-showcase-type-options';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" hint="Internal label shown to ops">
          <input
            className="input"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({
                ...f,
                name,
                slug: editing ? f.slug : slugifyBannerName(name)
              }));
            }}
            placeholder="Featured Categories"
          />
        </Field>

        <Field label="Slug" hint="URL-friendly key, must be unique">
          <input
            className="input font-mono text-sm"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            placeholder="featured-categories"
          />
        </Field>
      </div>

      <Field label="Type" hint="Pick a suggested type or enter a new one">
        <input
          className="input font-mono text-sm uppercase"
          list={datalistId}
          value={form.type}
          onChange={(e) => set('type', e.target.value.toUpperCase())}
          onBlur={(e) => set('type', normalizeCategoryShowcaseType(e.target.value))}
          placeholder="FEATURED"
          disabled={typesLoading}
        />
        <datalist id={datalistId}>
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{categoryShowcaseTypeLabel(opt.value, typeOptions)}</option>
          ))}
        </datalist>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display title">
          <input className="input" value={form.displayTitle} onChange={(e) => set('displayTitle', e.target.value)} />
        </Field>
        <Field label="Subtitle">
          <input className="input" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" hint="Higher = shown first on home page">
          <input type="number" className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)} min={0} />
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            <span className="text-sm text-gray-700">Active — visible on home page</span>
          </label>
        </Field>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create group'}
        </button>
        {!stayOnPage && (
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        )}
      </div>
    </form>
  );
}
