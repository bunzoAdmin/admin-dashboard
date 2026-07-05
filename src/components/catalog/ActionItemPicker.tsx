'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { catalogApi } from '@/lib/catalogApi';
import type { BannerActionType, CategoryTreeNode, ProductResponse } from '@/lib/catalogTypes';
import { flattenTreeForL2L3, type FlatCategoryOption } from '@/lib/categoryTreeUtils';

// ── Flat category item (L2 or L3 only) ───────────────────────────────────────
interface FlatCategory extends FlatCategoryOption {}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ActionItemPickerProps {
  actionType: BannerActionType;
  value: number[];
  onChange: (ids: number[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ActionItemPicker({ actionType, value, onChange }: ActionItemPickerProps) {
  const isCategory = actionType === 'CATEGORY_LIST';

  // Category mode state
  const [categories, setCategories] = useState<FlatCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Product mode state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared
  const [filterText, setFilterText] = useState('');

  // Load category tree once when in category mode
  useEffect(() => {
    if (!isCategory) return;
    setCatLoading(true);
    setCatError(null);
    catalogApi.getCategoryTree()
      .then((tree) => setCategories(flattenTreeForL2L3(tree)))
      .catch(() => setCatError('Failed to load categories.'))
      .finally(() => setCatLoading(false));
  }, [isCategory]);

  // Debounced product search
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    catalogApi.searchProducts(q, 40)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (isCategory) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isCategory, doSearch]);

  // Reset filter when action type changes
  useEffect(() => {
    setFilterText('');
    setQuery('');
    setResults([]);
  }, [actionType]);

  function toggle(id: number) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  function remove(id: number) {
    onChange(value.filter((v) => v !== id));
  }

  // ── Category mode ─────────────────────────────────────────────────────────
  if (isCategory) {
    const filtered = filterText.trim()
      ? categories.filter((c) => c.breadcrumb.toLowerCase().includes(filterText.toLowerCase()))
      : categories;

    // Map selected IDs to labels for chips
    const selectedLabels = value.map((id) => {
      const cat = categories.find((c) => c.id === id);
      return { id, label: cat?.breadcrumb ?? `#${id}` };
    });

    return (
      <div className="space-y-2">
        {/* Selected chips */}
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedLabels.map(({ id, label }) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700"
              >
                {label}
                <button
                  type="button"
                  className="ml-0.5 hover:text-blue-900"
                  onClick={() => remove(id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search / filter */}
        <input
          className="input text-sm"
          placeholder="Filter categories…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />

        {/* List */}
        {catLoading && <p className="text-xs text-gray-400">Loading categories…</p>}
        {catError && <p className="text-xs text-red-500">{catError}</p>}
        {!catLoading && !catError && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No categories found.</p>
            ) : (
              filtered.map((cat) => {
                const checked = value.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50/60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      checked={checked}
                      onChange={() => toggle(cat.id)}
                    />
                    <span className="text-sm text-gray-800">{cat.breadcrumb}</span>
                    <span className="ml-auto text-xs text-gray-400 shrink-0">#{cat.id}</span>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Product mode ──────────────────────────────────────────────────────────
  // Map selected IDs to labels (from search results or fallback)
  const allKnown = results;
  const selectedLabels = value.map((id) => {
    const p = allKnown.find((r) => r.id === id);
    return { id, label: p ? `${p.name} (${p.sku})` : `#${id}` };
  });

  const unselectedResults = results.filter((r) => !value.includes(r.id));

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map(({ id, label }) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {label}
              <button
                type="button"
                className="ml-0.5 hover:text-indigo-900"
                onClick={() => remove(id)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <input
        className="input text-sm"
        placeholder="Search products by name or SKU…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Results */}
      {searching && <p className="text-xs text-gray-400">Searching…</p>}
      {!searching && query.trim() && results.length === 0 && (
        <p className="text-xs text-gray-400">No products found for "{query}".</p>
      )}
      {!searching && unselectedResults.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {unselectedResults.map((product) => (
            <label
              key={product.id}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={false}
                onChange={() => toggle(product.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{product.name}</p>
                <p className="text-xs text-gray-400">{product.sku}{product.categoryName ? ` · ${product.categoryName}` : ''}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">#{product.id}</span>
            </label>
          ))}
        </div>
      )}
      {!query.trim() && value.length === 0 && (
        <p className="text-xs text-gray-400">Type to search for products.</p>
      )}
    </div>
  );
}
