'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { ProductResponse } from '@/lib/catalogTypes';
import { searchProducts } from '@/lib/fuzzySearch';
import { Field } from '@/components/ui';

/** Loads the full catalog once and shares it across every SkuPicker on the page. */
let catalogPromise: Promise<ProductResponse[]> | null = null;
function loadCatalog(): Promise<ProductResponse[]> {
  if (!catalogPromise) {
    catalogPromise = catalogApi.getAllProducts().catch((err) => {
      catalogPromise = null;
      throw err;
    });
  }
  return catalogPromise;
}

function useCatalog() {
  const [catalog, setCatalog] = useState<ProductResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((products) => {
        if (!cancelled) setCatalog(products);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof CatalogApiError ? err.message : 'Failed to load catalog.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, error };
}

function Suggestions({
  products,
  onPick,
  highlightSku
}: {
  products: ProductResponse[];
  onPick: (p: ProductResponse) => void;
  highlightSku?: (sku: string) => 'selected' | 'registered' | null;
}) {
  if (products.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-400">No matching products.</p>;
  }
  return (
    <ul className="max-h-64 overflow-y-auto py-1">
      {products.map((p) => {
        const tag = highlightSku?.(p.sku);
        return (
          <li key={p.id}>
            <button
              type="button"
              disabled={tag === 'selected'}
              onMouseDown={(e) => {
                // Prevent the input's blur from firing before the click is handled.
                e.preventDefault();
                onPick(p);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition ${
                tag === 'selected' ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-50'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-gray-900">{p.name}</span>
                <span className="font-mono text-xs text-gray-400">{p.sku}</span>
              </span>
              {tag === 'selected' && <span className="text-xs text-gray-400">Added</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Single-SKU typeahead — replaces manually typing a SKU. */
export function SkuPicker({
  value,
  onChange,
  label = 'SKU',
  placeholder = 'Search by name or SKU…'
}: {
  value: string;
  onChange: (sku: string, product?: ProductResponse) => void;
  label?: string;
  placeholder?: string;
}) {
  const { catalog, error } = useCatalog();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!catalog) return [];
    return searchProducts(catalog, query, 20);
  }, [catalog, query]);

  return (
    <div ref={containerRef} className="relative">
      <Field label={label} hint={error ?? undefined}>
        <input
          className="input font-mono"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={catalog === null ? 'Loading catalog…' : placeholder}
        />
      </Field>
      {open && catalog && (
        <div className="absolute z-20 mt-1 w-full min-w-[260px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <Suggestions
            products={results}
            onPick={(p) => {
              onChange(p.sku, p);
              setQuery(p.sku);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Multi-SKU picker — search + chip list, replacing a manual comma/newline textarea. */
export function SkuMultiPicker({
  skus,
  onChange,
  label = 'SKUs',
  hint,
  renderBadge
}: {
  skus: string[];
  onChange: (skus: string[]) => void;
  label?: string;
  hint?: string;
  /** Optional extra badge rendered next to each chip (e.g. ZRA registration status). */
  renderBadge?: (sku: string) => ReactNode;
}) {
  const { catalog, error } = useCatalog();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectedSet = useMemo(() => new Set(skus), [skus]);
  const results = useMemo(() => {
    if (!catalog) return [];
    return searchProducts(catalog, query, 20);
  }, [catalog, query]);

  const bySku = useMemo(() => {
    const m = new Map<string, ProductResponse>();
    catalog?.forEach((p) => m.set(p.sku, p));
    return m;
  }, [catalog]);

  function add(sku: string) {
    if (!skus.includes(sku)) onChange([...skus, sku]);
    setQuery('');
  }

  function remove(sku: string) {
    onChange(skus.filter((s) => s !== sku));
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Field label={label} hint={error ?? hint}>
        <input
          className="input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={catalog === null ? 'Loading catalog…' : 'Search by name or SKU to add…'}
        />
      </Field>
      {open && catalog && (
        <div className="absolute z-20 mt-1 w-full min-w-[260px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <Suggestions products={results} onPick={(p) => add(p.sku)} highlightSku={(sku) => (selectedSet.has(sku) ? 'selected' : null)} />
        </div>
      )}
      {skus.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skus.map((sku) => (
            <span
              key={sku}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1 text-xs"
            >
              <span className="font-mono text-gray-700">{sku}</span>
              {bySku.get(sku) && <span className="max-w-[10rem] truncate text-gray-400">{bySku.get(sku)!.name}</span>}
              {renderBadge?.(sku)}
              <button
                type="button"
                className="rounded-full px-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                onClick={() => remove(sku)}
                aria-label={`Remove ${sku}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
