'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { catalogApi } from '@/lib/catalogApi';
import { resolveCatalogImageUrl } from '@/lib/catalogImageUrl';
import type { ProductResponse } from '@/lib/catalogTypes';
import { Spinner } from '@/components/ui';

export interface SelectedProduct {
  id: number;
  name: string;
  slug: string;
  brand?: string | null;
  basePrice: number;
  images: string[];
}

interface ShowcaseProductPickerProps {
  /** Current ranked selection. */
  value: SelectedProduct[];
  /** Called whenever the selection or order changes (reorder). */
  onChange: (products: SelectedProduct[]) => void;
  /** When set, Add button calls this instead of updating local selection (for persisted groups). */
  onAdd?: (product: ProductResponse) => void | Promise<void>;
  /** When set, Remove button calls this instead of updating local selection (for persisted groups). */
  onRemove?: (productId: number) => void | Promise<void>;
  addingId?: number | null;
  removingId?: number | null;
}

function productToSelected(p: ProductResponse): SelectedProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug ?? String(p.id),
    brand: p.brand,
    basePrice: p.basePrice,
    images: p.images ?? []
  };
}

export function showcaseItemsToSelected(items: ProductResponse[]): SelectedProduct[] {
  return items.map(productToSelected);
}

function formatPrice(price: number): string {
  return `K${price.toFixed(2)}`;
}

function ProductThumb({ images, name }: { images: string[]; name: string }) {
  const imgUrl = resolveCatalogImageUrl(images[0]);
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">—</div>
      )}
    </div>
  );
}

export function ShowcaseProductPicker({
  value,
  onChange,
  onAdd,
  onRemove,
  addingId,
  removingId
}: ShowcaseProductPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set(value.map((p) => p.id));

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    catalogApi.searchProducts(q, 40)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  function addProduct(product: ProductResponse) {
    if (selectedIds.has(product.id)) return;
    if (onAdd) {
      void onAdd(product);
      return;
    }
    onChange([...value, productToSelected(product)]);
  }

  function removeProduct(id: number) {
    if (onRemove) {
      void onRemove(id);
      return;
    }
    onChange(value.filter((p) => p.id !== id));
  }

  function moveProduct(idx: number, direction: -1 | 1) {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= value.length) return;
    const next = [...value];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    onChange(next);
  }

  const unselectedResults = results.filter((r) => !selectedIds.has(r.id));

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          className="input text-sm"
          placeholder="Search products by name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
            <Spinner className="h-3 w-3" /> Searching…
          </p>
        )}
        {!searching && query.trim() && unselectedResults.length === 0 && (
          <p className="mt-1.5 text-xs text-gray-400">No matching products found.</p>
        )}
        {!searching && unselectedResults.length > 0 && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {unselectedResults.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
              >
                <ProductThumb images={product.images ?? []} name={product.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">
                    {product.brand ? `${product.brand} · ` : ''}{formatPrice(product.basePrice)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost text-xs shrink-0"
                  disabled={addingId === product.id}
                  onClick={() => addProduct(product)}
                >
                  {addingId === product.id ? <Spinner className="h-3.5 w-3.5" /> : <><Plus className="h-3.5 w-3.5" /> Add</>}
                </button>
              </div>
            ))}
          </div>
        )}
        {!query.trim() && value.length === 0 && (
          <p className="mt-1.5 text-xs text-gray-400">Type to search and add products.</p>
        )}
      </div>

      {/* Selected list */}
      {value.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Selected ({value.length}) — use arrows to reorder
          </p>
          <div className="space-y-2">
            {value.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5"
              >
                <span className="w-5 shrink-0 text-center text-sm font-mono text-gray-400">{idx + 1}</span>
                <ProductThumb images={product.images} name={product.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">
                    {product.brand ? `${product.brand} · ` : ''}{formatPrice(product.basePrice)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title="Move up"
                    className="btn-ghost p-1 disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => moveProduct(idx, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    className="btn-ghost p-1 disabled:opacity-30"
                    disabled={idx === value.length - 1}
                    onClick={() => moveProduct(idx, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    className="btn-ghost p-1 text-red-500 hover:bg-red-50"
                    disabled={removingId === product.id}
                    onClick={() => removeProduct(product.id)}
                  >
                    {removingId === product.id ? <Spinner className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
