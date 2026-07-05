'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { catalogApi } from '@/lib/catalogApi';
import type { CategoryResponse } from '@/lib/catalogTypes';
import { flattenTreeForL2L3, type FlatCategoryOption } from '@/lib/categoryTreeUtils';
import { Spinner } from '@/components/ui';

export interface SelectedCategory {
  id: number;
  name: string;
  slug: string;
  breadcrumb: string;
}

interface CategoryShowcaseCategoryPickerProps {
  value: SelectedCategory[];
  onChange: (categories: SelectedCategory[]) => void;
  onAdd?: (categoryId: number) => void | Promise<void>;
  onRemove?: (categoryId: number) => void | Promise<void>;
  addingId?: number | null;
  removingId?: number | null;
}

function categoryToSelected(c: FlatCategoryOption): SelectedCategory {
  return { id: c.id, name: c.name, slug: String(c.id), breadcrumb: c.breadcrumb };
}

function responseToSelected(c: CategoryResponse, all: FlatCategoryOption[]): SelectedCategory {
  const flat = all.find((x) => x.id === c.id);
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    breadcrumb: flat?.breadcrumb ?? c.name
  };
}

export function showcaseCategoriesToSelected(
  items: CategoryResponse[],
  allOptions?: FlatCategoryOption[]
): SelectedCategory[] {
  if (allOptions) {
    return items.map((c) => responseToSelected(c, allOptions));
  }
  return items.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    breadcrumb: c.name
  }));
}

export function CategoryShowcaseCategoryPicker({
  value,
  onChange,
  onAdd,
  onRemove,
  addingId,
  removingId
}: CategoryShowcaseCategoryPickerProps) {
  const [allCategories, setAllCategories] = useState<FlatCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    setLoading(true);
    catalogApi.getCategoryTree()
      .then((tree) => setAllCategories(flattenTreeForL2L3(tree)))
      .catch(() => setLoadError('Failed to load categories.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedIds = new Set(value.map((c) => c.id));

  const filtered = filterText.trim()
    ? allCategories.filter((c) => c.breadcrumb.toLowerCase().includes(filterText.toLowerCase()))
    : allCategories;

  const available = filtered.filter((c) => !selectedIds.has(c.id));

  function addCategory(cat: FlatCategoryOption) {
    if (selectedIds.has(cat.id)) return;
    if (onAdd) {
      void onAdd(cat.id);
      return;
    }
    onChange([...value, categoryToSelected(cat)]);
  }

  function removeCategory(id: number) {
    if (onRemove) {
      void onRemove(id);
      return;
    }
    onChange(value.filter((c) => c.id !== id));
  }

  function moveCategory(idx: number, direction: -1 | 1) {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= value.length) return;
    const next = [...value];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Add categories (L2 / L3 only)
        </p>
        <input
          className="input text-sm"
          placeholder="Filter categories…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        {loading && <p className="mt-2 text-xs text-gray-400">Loading categories…</p>}
        {loadError && <p className="mt-2 text-xs text-red-500">{loadError}</p>}
        {!loading && !loadError && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {available.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No categories to add.</p>
            ) : (
              available.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{cat.breadcrumb}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost text-xs shrink-0"
                    disabled={addingId === cat.id}
                    onClick={() => addCategory(cat)}
                  >
                    {addingId === cat.id ? <Spinner className="h-3 w-3" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Selected ({value.length})
        </p>
        {value.length === 0 ? (
          <p className="text-sm text-gray-400">No categories selected yet.</p>
        ) : (
          <ul className="space-y-2">
            {value.map((cat, idx) => (
              <li key={cat.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="text-xs font-mono text-gray-400 w-5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{cat.breadcrumb}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" className="btn-ghost p-1" disabled={idx === 0} onClick={() => moveCategory(idx, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="btn-ghost p-1" disabled={idx === value.length - 1} onClick={() => moveCategory(idx, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost p-1 text-red-600"
                    disabled={removingId === cat.id}
                    onClick={() => removeCategory(cat.id)}
                  >
                    {removingId === cat.id ? <Spinner className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
