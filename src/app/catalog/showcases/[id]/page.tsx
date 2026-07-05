'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layers, Pencil } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { ProductResponse, ShowcaseGroupResponse } from '@/lib/catalogTypes';
import { showcaseTypeLabel } from '@/lib/catalogTypes';
import { ShowcaseGroupForm } from '@/components/catalog/ShowcaseGroupForm';
import {
  ShowcaseProductPicker,
  showcaseItemsToSelected,
  type SelectedProduct
} from '@/components/catalog/ShowcaseProductPicker';
import { Badge, Card, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';

export default function ShowcaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<ShowcaseGroupResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);

  const [orderedProducts, setOrderedProducts] = useState<SelectedProduct[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const g = await catalogApi.getShowcaseGroup(groupId);
      setGroup(g);
      setOrderedProducts(showcaseItemsToSelected(g.products ?? []));
      setOrderDirty(false);
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load showcase group.');
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  async function handleAddProduct(product: ProductResponse) {
    setAddingId(product.id);
    try {
      await catalogApi.addShowcaseItems(groupId, { productIds: [product.id] });
      toast.push('success', `"${product.name}" added.`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to add product.');
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemoveProduct(productId: number) {
    setRemovingId(productId);
    try {
      await catalogApi.removeShowcaseItem(groupId, productId);
      toast.push('success', 'Product removed.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to remove product.');
    } finally {
      setRemovingId(null);
    }
  }

  function handleReorder(products: SelectedProduct[]) {
    setOrderedProducts(products);
    setOrderDirty(true);
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    try {
      await catalogApi.reorderShowcaseItems(groupId, {
        productIds: orderedProducts.map((p) => p.id)
      });
      toast.push('success', 'Product order saved.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to save order.');
    } finally {
      setSavingOrder(false);
    }
  }

  if (loadError) return <ErrorBox message={loadError} />;
  if (!group) return <Loading label="Loading showcase group…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Layers className="h-5 w-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
            <Badge tone={group.isActive ? 'green' : 'gray'}>
              {group.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge tone="blue">{showcaseTypeLabel(group.type)}</Badge>
          </div>
          <p className="text-sm text-gray-500 font-mono">{group.slug}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => setEditingDetails((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" />
            {editingDetails ? 'Cancel edit' : 'Edit details'}
          </button>
          <button className="btn-ghost text-sm" onClick={() => router.push('/catalog/showcases')}>
            ← All showcases
          </button>
        </div>
      </div>

      {!editingDetails ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Group details</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Display title</dt>
              <dd className="mt-0.5 text-gray-800">{group.displayTitle || group.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Subtitle</dt>
              <dd className="mt-0.5 text-gray-800">{group.subtitle || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Priority</dt>
              <dd className="mt-0.5 text-gray-800">{group.priority}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Products</dt>
              <dd className="mt-0.5 text-gray-800">{orderedProducts.length} assigned</dd>
            </div>
          </dl>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Edit group details</h2>
          <ShowcaseGroupForm
            editing={group}
            stayOnPage
            onSaved={(saved) => {
              setGroup(saved);
              setEditingDetails(false);
              toast.push('success', 'Group details saved.');
            }}
          />
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Products ({orderedProducts.length})
          </h2>
          {orderDirty && (
            <button
              className="btn-primary text-sm"
              disabled={savingOrder}
              onClick={handleSaveOrder}
            >
              {savingOrder ? <Spinner className="h-4 w-4" /> : 'Save order'}
            </button>
          )}
        </div>

        <ShowcaseProductPicker
          value={orderedProducts}
          onChange={handleReorder}
          onAdd={handleAddProduct}
          onRemove={handleRemoveProduct}
          addingId={addingId}
          removingId={removingId}
        />
      </Card>
    </div>
  );
}
