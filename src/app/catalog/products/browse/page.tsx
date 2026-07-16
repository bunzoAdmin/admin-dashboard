'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { CategoryTreeNode, ProductResponse } from '@/lib/catalogTypes';
import {
  expandCategorySelectionToSubtreeIds,
  flattenTreeAtDepth
} from '@/lib/categoryTreeUtils';
import { downloadProductsCsv } from '@/lib/exportProductsCsv';
import { CategoryLevelMultiFilter } from '@/components/catalog/CategoryLevelMultiFilter';
import { Badge, Card, EmptyState, ErrorBox, Loading, money } from '@/components/ui';

export default function BrowseProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ProductResponse[] | null>(null);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [l1Ids, setL1Ids] = useState<number[]>([]);
  const [l2Ids, setL2Ids] = useState<number[]>([]);
  const [l3Ids, setL3Ids] = useState<number[]>([]);
  const [categoryMatchMode, setCategoryMatchMode] = useState<'subtree' | 'exact'>('subtree');

  const l1Options = useMemo(() => flattenTreeAtDepth(tree, 1), [tree]);
  const l2Options = useMemo(() => flattenTreeAtDepth(tree, 2), [tree]);
  const l3Options = useMemo(() => flattenTreeAtDepth(tree, 3), [tree]);

  const selectedCategoryIds = useMemo(() => [...l1Ids, ...l2Ids, ...l3Ids], [l1Ids, l2Ids, l3Ids]);

  const selectedCategoryIdSet = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);

  const matchingCategoryIds = useMemo(
    () => expandCategorySelectionToSubtreeIds(tree, selectedCategoryIds),
    [tree, selectedCategoryIds]
  );

  const filteredItems = useMemo(() => {
    if (!items) return null;
    if (selectedCategoryIds.length === 0) return items;
    if (categoryMatchMode === 'exact') {
      return items.filter((p) => selectedCategoryIdSet.has(p.categoryId));
    }
    return items.filter((p) => matchingCategoryIds.has(p.categoryId));
  }, [items, selectedCategoryIds.length, categoryMatchMode, selectedCategoryIdSet, matchingCategoryIds]);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = q.trim()
        ? await catalogApi.searchProducts(q.trim(), 5000)
        : await catalogApi.getAllProducts();
      setItems(list);
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Failed to load products.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
    catalogApi
      .getCategoryTree()
      .then(setTree)
      .catch(() => setTree([]));
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    load(query);
  }

  function clearCategoryFilters() {
    setL1Ids([]);
    setL2Ids([]);
    setL3Ids([]);
  }

  const hasCategoryFilters = selectedCategoryIds.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Browse products</h1>
          <p className="text-sm text-gray-500">Search the catalog or open a product by barcode.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost text-sm inline-flex items-center gap-1.5"
            disabled={!filteredItems?.length}
            onClick={() => {
              if (!filteredItems?.length) return;
              const stamp = new Date().toISOString().slice(0, 10);
              downloadProductsCsv(filteredItems, `products-${stamp}.csv`);
            }}
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
          <Link href="/catalog/products" className="btn-primary text-sm">
            Scan barcode
          </Link>
        </div>
      </div>

      <Card className="max-w-xl">
        <form onSubmit={onSearch} className="flex gap-2">
          <input
            className="input flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, brand…"
          />
          <button type="submit" className="btn-primary shrink-0">
            Search
          </button>
        </form>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-800">Filter by category</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span>Match:</span>
              <select
                className="input py-1 text-xs"
                value={categoryMatchMode}
                onChange={(e) => setCategoryMatchMode(e.target.value as 'subtree' | 'exact')}
              >
                <option value="subtree">Include subcategories</option>
                <option value="exact">Exact category only</option>
              </select>
            </label>
            {hasCategoryFilters && (
              <button type="button" className="text-xs text-gray-500 hover:text-gray-800" onClick={clearCategoryFilters}>
                Clear all category filters
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {categoryMatchMode === 'exact'
            ? 'Shows products linked directly to the selected categories — useful for spotting mislinked L1/L2 assignments.'
            : 'Pick any L1, L2, or L3 categories independently. Products match if they sit under any selected category.'}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <CategoryLevelMultiFilter label="L1" options={l1Options} selectedIds={l1Ids} onChange={setL1Ids} />
          <CategoryLevelMultiFilter label="L2" options={l2Options} selectedIds={l2Ids} onChange={setL2Ids} />
          <CategoryLevelMultiFilter label="L3" options={l3Options} selectedIds={l3Ids} onChange={setL3Ids} />
        </div>
      </Card>

      {error && <ErrorBox message={error} />}
      {loading && <Loading label="Loading products…" />}

      {!loading && filteredItems && filteredItems.length === 0 && <EmptyState>No products found.</EmptyState>}

      {!loading && filteredItems && filteredItems.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-gray-100 px-5 py-2 text-xs text-gray-500">
            Showing {filteredItems.length}
            {items && items.length !== filteredItems.length ? ` of ${items.length}` : ''} products
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Barcode</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{p.sku}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-3 text-gray-600">{p.categoryName ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.barcode ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{money(p.basePrice)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={p.isActive !== false ? 'green' : 'gray'}>
                      {p.isActive !== false ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm font-medium text-brand-green-dark hover:underline"
                      onClick={() => {
                        const barcode = p.barcode?.trim();
                        const base = barcode
                          ? `/catalog/products?barcode=${encodeURIComponent(barcode)}`
                          : `/catalog/products?id=${p.id}`;
                        router.push(`${base}&from=browse`);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
