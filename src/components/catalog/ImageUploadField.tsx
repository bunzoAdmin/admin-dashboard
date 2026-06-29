'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import { catalogImageBaseConfigured, resolveCatalogImageUrl } from '@/lib/catalogImageUrl';
import { ErrorBox, Field, Spinner } from '@/components/ui';

export type ImageUploadScope = 'category' | 'product';

interface ImageUploadFieldProps {
  scope: ImageUploadScope;
  slug: string;
  label?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  multiple?: boolean;
}

function parseKeys(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function nextImageIndex(existing: string[]): number | undefined {
  if (existing.length === 0) return undefined;
  let max = 1;
  for (const key of existing) {
    const file = key.split('/').pop() ?? '';
    if (file.startsWith('original.')) {
      max = Math.max(max, 1);
      continue;
    }
    const dot = file.lastIndexOf('.');
    const base = dot > 0 ? file.slice(0, dot) : file;
    if (/^\d+$/.test(base)) {
      max = Math.max(max, parseInt(base, 10));
    }
  }
  return max + 1;
}

function ImagePreview({ src, uploading, alt }: { src: string; uploading?: boolean; alt: string }) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Spinner className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

export function ImageUploadField({
  scope,
  slug,
  label = 'Image',
  hint,
  value,
  onChange,
  multiple = false
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  function setLocalPreviewUrl(url: string | null) {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    if (url) {
      localPreviewRef.current = url;
    }
    setLocalPreview(url);
  }

  useEffect(
    () => () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    },
    []
  );

  async function handleFile(file: File) {
    const slugTrimmed = slug.trim();
    if (!slugTrimmed) {
      setError('Enter a name (and slug) before uploading.');
      return;
    }

    setUploading(true);
    setError(null);
    setLocalPreviewUrl(URL.createObjectURL(file));

    try {
      const existing = parseKeys(value);
      const index = multiple && existing.length > 0 ? nextImageIndex(existing) : undefined;
      const r2Key = await catalogApi.uploadImage(file, { scope, slug: slugTrimmed, index });

      if (multiple) {
        onChange([...existing, r2Key].join(', '));
      } else {
        onChange(r2Key);
      }
      setLocalPreviewUrl(null);
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Upload failed.');
      setLocalPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    setLocalPreviewUrl(null);
    onChange('');
  }

  const keys = parseKeys(value);
  const storedPreviews = keys
    .map((key) => ({ key, src: resolveCatalogImageUrl(key) }))
    .filter((item): item is { key: string; src: string } => item.src != null);

  const showSinglePreview = !multiple && (localPreview ?? storedPreviews[0]?.src);
  const showMultiplePreviews = multiple && (localPreview || storedPreviews.length > 0);

  return (
    <Field
      label={label}
      hint={
        hint ??
        (multiple
          ? 'Upload JPEG/PNG (max 5MB). Stored as R2 keys under products/{slug}/. You can upload multiple images.'
          : 'Upload JPEG/PNG (max 5MB). Stored as R2 key under categories/{slug}/ or products/{slug}/.')
      }
    >
      <div className="space-y-3">
        {keys.length > 0 && (
          <div className="space-y-1">
            {keys.map((key) => (
              <p key={key} className="font-mono text-xs text-gray-600 break-all">
                {key}
              </p>
            ))}
          </div>
        )}

        {showSinglePreview && (
          <ImagePreview
            src={localPreview ?? storedPreviews[0]!.src}
            uploading={uploading}
            alt="Category image preview"
          />
        )}

        {showMultiplePreviews && (
          <div className="flex flex-wrap gap-2">
            {storedPreviews.map(({ key, src }) => (
              <ImagePreview key={key} src={src} alt={`Image ${key}`} />
            ))}
            {localPreview && <ImagePreview src={localPreview} uploading={uploading} alt="New image preview" />}
          </div>
        )}

        {keys.length > 0 && !catalogImageBaseConfigured() && !localPreview && (
          <p className="text-xs text-amber-700">
            Set <span className="font-mono">NEXT_PUBLIC_CATALOG_IMAGE_BASE_URL</span> to preview stored images (e.g.{' '}
            <span className="font-mono">http://localhost:9000/product-images</span>).
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : keys.length > 0 && multiple ? 'Add image' : keys.length > 0 ? 'Replace image' : 'Upload image'}
          </button>
          {keys.length > 0 && (
            <button type="button" className="btn-ghost text-sm text-red-600" disabled={uploading} onClick={handleClear}>
              Clear
            </button>
          )}
        </div>

        <input
          className="input font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="R2 key (auto-filled after upload) or paste manually"
        />

        {error && <ErrorBox message={error} />}
      </div>
    </Field>
  );
}
