'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { ProductResponse } from '@/lib/catalogTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, money } from '@/components/ui';

export default function BrowseProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ProductResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = q.trim() ? await catalogApi.searchProducts(q.trim()) : await catalogApi.getAllProducts();
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
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    load(query);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Browse products</h1>
          <p className="text-sm text-gray-500">Search the catalog or open a product by barcode.</p>
        </div>
        <Link href="/catalog/products" className="btn-primary text-sm">
          Scan barcode
        </Link>
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

      {error && <ErrorBox message={error} />}
      {loading && <Loading label="Loading products…" />}

      {!loading && items && items.length === 0 && <EmptyState>No products found.</EmptyState>}

      {!loading && items && items.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Brand</th>
                <th className="px-5 py-3 font-medium">Barcode</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{p.sku}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-3 text-gray-600">{p.brand ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.barcode ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{money(p.basePrice)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={p.isActive !== false ? 'green' : 'gray'}>{p.isActive !== false ? 'active' : 'inactive'}</Badge>
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
