'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { BannerResponse } from '@/lib/catalogTypes';
import { BannerForm } from '@/components/catalog/BannerForm';
import { ErrorBox, Loading } from '@/components/ui';

export default function EditBannerPage() {
  const params = useParams<{ id: string }>();
  const [banner, setBanner] = useState<BannerResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) return;
    catalogApi.getBanner(id)
      .then(setBanner)
      .catch((err) => setLoadError(err instanceof CatalogApiError ? err.message : 'Failed to load banner.'));
  }, [params.id]);

  if (loadError) return <ErrorBox message={loadError} />;
  if (!banner) return <Loading label="Loading banner…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Edit banner</h1>
        <p className="text-sm text-gray-500">
          Editing <span className="font-medium text-gray-700">{banner.title}</span>
          <span className="ml-1 font-mono text-xs text-gray-400">#{banner.id}</span>
        </p>
      </div>
      <BannerForm editing={banner} />
    </div>
  );
}
