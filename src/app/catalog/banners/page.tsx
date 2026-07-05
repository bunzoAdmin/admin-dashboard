'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import { resolveCatalogImageUrl } from '@/lib/catalogImageUrl';
import type { BannerResponse } from '@/lib/catalogTypes';
import { BANNER_ACTION_TYPE_OPTIONS } from '@/lib/catalogTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, useToast } from '@/components/ui';

export default function BannersPage() {
  const toast = useToast();
  const [banners, setBanners] = useState<BannerResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await catalogApi.listBanners();
      setBanners(data);
    } catch (err) {
      setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load banners.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(banner: BannerResponse) {
    if (!confirm(`Delete banner "${banner.title}"? This also removes it from all time slots.`)) return;
    setDeleting(banner.id);
    try {
      await catalogApi.deleteBanner(banner.id);
      toast.push('success', `Banner "${banner.title}" deleted.`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof CatalogApiError ? err.message : 'Failed to delete banner.');
    } finally {
      setDeleting(null);
    }
  }

  function actionLabel(type: string) {
    return BANNER_ACTION_TYPE_OPTIONS.find((o) => o.value === type)?.label.split(' —')[0] ?? type;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Banners</h1>
          <p className="text-sm text-gray-500">
            Clickable tiles shown in the home carousel. Assign banners to time slots to schedule when they appear.
          </p>
        </div>
        <Link href="/catalog/banners/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New banner
        </Link>
      </div>

      {loadError && <ErrorBox message={loadError} />}

      {banners === null && !loadError && <Loading label="Loading banners…" />}

      {banners?.length === 0 && (
        <EmptyState>No banners yet. Create one and assign it to a time slot.</EmptyState>
      )}

      {banners && banners.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((banner) => {
            const imgUrl = resolveCatalogImageUrl(banner.imageUrl);
            return (
              <Card key={banner.id} className="flex flex-col gap-3">
                {/* Thumbnail */}
                <div className="relative h-36 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt={banner.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-gray-300">
                      <ImageIcon className="h-8 w-8" />
                      <span className="mt-1 text-xs">No image</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{banner.title}</span>
                    <Badge tone={banner.isActive ? 'green' : 'gray'}>
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-gray-400">{banner.slug}</p>
                  <Badge tone="blue">{actionLabel(banner.actionType)}</Badge>
                  <p className="text-xs text-gray-500">
                    {banner.actionItemIds.length} item{banner.actionItemIds.length !== 1 ? 's' : ''} ·{' '}
                    IDs: {banner.actionItemIds.slice(0, 5).join(', ')}
                    {banner.actionItemIds.length > 5 ? '…' : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <Link href={`/catalog/banners/${banner.id}/edit`} className="btn-ghost text-sm">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <button
                    type="button"
                    className="btn-ghost text-sm text-red-600 hover:bg-red-50"
                    disabled={deleting === banner.id}
                    onClick={() => handleDelete(banner)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting === banner.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
