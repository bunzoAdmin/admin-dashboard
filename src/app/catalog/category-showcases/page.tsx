'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { CategoryShowcaseGroupResponse } from '@/lib/catalogTypes';
import { categoryShowcaseTypeLabel } from '@/lib/catalogTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, useToast } from '@/components/ui';

export default function CategoryShowcasesPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<CategoryShowcaseGroupResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setGroups(await catalogApi.listCategoryShowcaseGroups());
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load category showcase groups.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(group: CategoryShowcaseGroupResponse) {
    if (!confirm(`Delete category showcase group "${group.name}"?`)) return;
    setDeleting(group.id);
    try {
      await catalogApi.deleteCategoryShowcaseGroup(group.id);
      toast.push('success', `Category showcase group "${group.name}" deleted.`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to delete group.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Category Showcases</h1>
          <p className="text-sm text-gray-500">
            Curated category collections for the home screen — link L2 and L3 categories only.
          </p>
        </div>
        <Link href="/catalog/category-showcases/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New showcase group
        </Link>
      </div>

      {loadError && <ErrorBox message={loadError} />}
      {groups === null && !loadError && <Loading label="Loading category showcase groups…" />}
      {groups?.length === 0 && <EmptyState>No category showcase groups yet.</EmptyState>}

      {groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 truncate">{group.name}</span>
                    <Badge tone={group.isActive ? 'green' : 'gray'}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-gray-400">{group.slug}</p>
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <p>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Type</span>{' '}
                  <Badge tone="blue">{categoryShowcaseTypeLabel(group.type)}</Badge>
                </p>
                <p>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Categories</span>{' '}
                  {group.categories?.length ?? 0} assigned
                </p>
              </div>

              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <Link href={`/catalog/category-showcases/${group.id}`} className="btn-ghost text-sm">
                  <Pencil className="h-3.5 w-3.5" /> Manage
                </Link>
                <button
                  type="button"
                  className="btn-ghost text-sm text-red-600 hover:bg-red-50"
                  disabled={deleting === group.id}
                  onClick={() => handleDelete(group)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting === group.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
