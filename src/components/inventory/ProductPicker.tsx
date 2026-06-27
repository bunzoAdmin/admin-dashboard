'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { CategoryTreeNode, ProductResponse } from '@/lib/catalogTypes';
import { searchProducts } from '@/lib/fuzzySearch';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading } from '@/components/ui';

type PickerMode = 'search' | 'category';

interface ProductPickerProps {
  storeId: number;
  onSelect: (product: ProductResponse) => void;
}

export function ProductPicker({ storeId, onSelect }: ProductPickerProps) {
  const [mode, setMode] = useState<PickerMode>('search');
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<ProductResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryTreeNode | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<ProductResponse[] | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [products, categories] = await Promise.all([
          catalogApi.getAllProducts(),
          catalogApi.getCategoryTree()
        ]);
        if (!cancelled) {
          setCatalog(products);
          setTree(categories);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load catalog.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchResults = useMemo(() => {
    if (!catalog) return null;
    return searchProducts(catalog, query);
  }, [catalog, query]);

  const loadCategoryProducts = useCallback(
    async (category: CategoryTreeNode) => {
      setSelectedCategory(category);
      setCategoryLoading(true);
      try {
        const page = await catalogApi.getProductsByCategory(category.id, storeId, 0, 50);
        setCategoryProducts(page.content ?? []);
      } catch {
        setCategoryProducts([]);
      } finally {
        setCategoryLoading(false);
      }
    },
    [storeId]
  );

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Find product</h2>
          <p className="text-xs text-gray-500">Search the catalog or browse by category.</p>
        </div>
        <div className="flex rounded-lg border border-gray-300 p-0.5">
          {(['search', 'category'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition',
                mode === m ? 'bg-brand-green text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {loadError && <ErrorBox message={loadError} />}

      {mode === 'search' && (
        <div className="space-y-3">
          <Field label="Search" hint="Name, SKU, brand, or barcode — fuzzy matching.">
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing…"
              autoFocus
            />
          </Field>
          {catalog === null && !loadError ? (
            <Loading label="Loading catalog…" />
          ) : searchResults && searchResults.length === 0 ? (
            <EmptyState>{query.trim() ? 'No matching products.' : 'Type to search the catalog.'}</EmptyState>
          ) : searchResults ? (
            <ProductList items={searchResults} onSelect={onSelect} />
          ) : null}
        </div>
      )}

      {mode === 'category' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 p-2 lg:max-h-96">
            {tree.length === 0 ? (
              <p className="p-2 text-xs text-gray-400">No categories.</p>
            ) : (
              <CategoryTree
                nodes={tree}
                selectedId={selectedCategory?.id ?? null}
                onSelect={loadCategoryProducts}
              />
            )}
          </div>
          <div className="min-h-[12rem]">
            {!selectedCategory ? (
              <EmptyState>Select a category to list products.</EmptyState>
            ) : categoryLoading ? (
              <Loading label="Loading products…" />
            ) : categoryProducts && categoryProducts.length === 0 ? (
              <EmptyState>No products in {selectedCategory.name}.</EmptyState>
            ) : categoryProducts ? (
              <ProductList items={categoryProducts} onSelect={onSelect} compactHeader={selectedCategory.name} />
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}

function ProductList({
  items,
  onSelect,
  compactHeader
}: {
  items: ProductResponse[];
  onSelect: (p: ProductResponse) => void;
  compactHeader?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      {compactHeader && (
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">{compactHeader}</div>
      )}
      <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-gray-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">{p.name}</span>
                <span className="font-mono text-xs text-gray-400">
                  {p.sku}
                  {p.barcode ? ` · ${p.barcode}` : ''}
                </span>
              </span>
              <Badge tone={p.isActive !== false ? 'green' : 'gray'}>{p.isActive !== false ? 'active' : 'off'}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductSummary({ product }: { product: ProductResponse }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
        <p className="mt-0.5 font-mono text-xs text-gray-400">
          SKU {product.sku}
          {product.barcode ? ` · Barcode ${product.barcode}` : ''}
          {product.brand ? ` · ${product.brand}` : ''}
        </p>
      </div>
      <Badge tone={product.isActive !== false ? 'green' : 'gray'}>
        {product.isActive !== false ? 'Active' : 'Inactive'}
      </Badge>
    </div>
  );
}
