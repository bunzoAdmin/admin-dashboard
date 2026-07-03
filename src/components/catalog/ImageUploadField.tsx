'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Trash2, Upload } from 'lucide-react';
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

function keysToValue(keys: string[]): string {
  return keys.join(', ');
}

// 'add' = the trailing "Add image" slot; number = slot index being replaced
type UploadSlot = number | 'add';

export function ImageUploadField({
  scope,
  slug,
  label = 'Image',
  hint,
  value,
  onChange,
  multiple = false,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<UploadSlot>('add');

  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  // local preview blob URLs while an upload is in-flight, keyed by slot
  const previewUrlsRef = useRef<Map<UploadSlot, string>>(new Map());
  const [previewUrls, setPreviewUrls] = useState<Map<UploadSlot, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const map = previewUrlsRef.current;
    return () => { map.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  function setSlotPreview(slot: UploadSlot, url: string | null) {
    const prev = previewUrlsRef.current.get(slot);
    if (prev) URL.revokeObjectURL(prev);
    const next = new Map(previewUrlsRef.current);
    if (url) next.set(slot, url); else next.delete(slot);
    previewUrlsRef.current = next;
    setPreviewUrls(next);
  }

  function triggerUpload(slot: UploadSlot) {
    pendingSlotRef.current = slot;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(file: File) {
    const slugTrimmed = slug.trim();
    if (!slugTrimmed) {
      setError('Enter a name (and slug) before uploading.');
      return;
    }

    const slot = pendingSlotRef.current;
    const keys = parseKeys(value);

    // index param: position-based (1-indexed). slot 0 → 1 → "original-{epoch}.jpg"
    // add → keys.length + 1, but first-ever upload passes undefined → "original-{epoch}.jpg"
    const index: number | undefined =
      slot === 'add'
        ? keys.length === 0 ? undefined : keys.length + 1
        : (slot as number) + 1;

    setUploadingSlot(slot);
    setError(null);
    setSlotPreview(slot, URL.createObjectURL(file));

    try {
      const r2Key = await catalogApi.uploadImage(file, { scope, slug: slugTrimmed, index });
      const next = [...keys];
      if (slot === 'add') {
        next.push(r2Key);
      } else {
        next[slot as number] = r2Key;
      }
      onChange(keysToValue(next));
      setSlotPreview(slot, null);
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Upload failed.');
      setSlotPreview(slot, null);
    } finally {
      setUploadingSlot(null);
    }
  }

  function handleDelete(i: number) {
    const keys = parseKeys(value);
    keys.splice(i, 1);
    onChange(keysToValue(keys));
  }

  function handleMove(i: number, direction: 'up' | 'down') {
    const keys = parseKeys(value);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    onChange(keysToValue(keys));
  }

  const keys = parseKeys(value);
  const busy = uploadingSlot !== null;

  // ── Single-image mode (categories) ────────────────────────────────────────
  if (!multiple) {
    // Use slot 0 when replacing an existing image so handleFileSelected does
    // next[0] = r2Key (replace) instead of next.push(r2Key) (append).
    const replaceSlot: UploadSlot = keys[0] ? 0 : 'add';
    const previewSrc = previewUrls.get(replaceSlot) ?? resolveCatalogImageUrl(keys[0] ?? '');
    const uploading = busy;
    return (
      // Intentionally NOT using <Field> here: Field renders a <label> which would
      // make clicking anywhere inside (image, key text, etc.) open the file picker
      // via the hidden <input type="file"> descendant.
      <div className="block space-y-1.5">
        <span className="label">{label}</span>
        <div className="space-y-2">
          {previewSrc && (
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt="Category image" className="h-full w-full object-cover" />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Spinner className="h-5 w-5" />
                </div>
              )}
            </div>
          )}
          {keys[0] && <p className="font-mono text-xs text-gray-500 break-all">{keys[0]}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={busy}
              onClick={() => triggerUpload(replaceSlot)}
            >
              {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : keys[0] ? 'Replace' : 'Upload image'}
            </button>
            {keys[0] && (
              <button
                type="button"
                className="btn-ghost text-sm text-red-600"
                disabled={busy}
                onClick={() => onChange('')}
              >
                Clear
              </button>
            )}
          </div>
          {error && <ErrorBox message={error} />}
        </div>
        {hint && <span className="block text-xs text-gray-400">{hint ?? 'Upload JPEG/PNG (max 5MB).'}</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleFileSelected(f); }}
        />
      </div>
    );
  }

  // ── Multi-image mode (products) ───────────────────────────────────────────
  // Intentionally NOT using <Field> here: Field renders a <label> which would
  // make clicking anywhere inside (thumbnails, key text, etc.) open the file
  // picker via the hidden <input type="file"> descendant.
  return (
    <div className="block space-y-1.5">
      <span className="label">{label}</span>
      <div className="space-y-3">
        {!catalogImageBaseConfigured() && keys.length > 0 && (
          <p className="text-xs text-amber-700">
            Set <span className="font-mono">NEXT_PUBLIC_CATALOG_IMAGE_BASE_URL</span> to preview stored images.
          </p>
        )}

        <div className="flex flex-wrap gap-3 items-start">
          {keys.map((key, i) => {
            const localPreview = previewUrls.get(i);
            const storedSrc = resolveCatalogImageUrl(key);
            const src = localPreview ?? storedSrc;
            const slotUploading = uploadingSlot === i;

            return (
              <div key={key} className="flex flex-col gap-1" style={{ width: '7rem' }}>
                {/* Thumbnail */}
                <div className="relative h-24 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                      No preview
                    </div>
                  )}
                  {slotUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Spinner className="h-5 w-5" />
                    </div>
                  )}
                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">
                      hero
                    </span>
                  )}
                </div>

                {/* R2 key */}
                <p className="font-mono text-[10px] text-gray-500 break-all leading-tight line-clamp-2" title={key}>
                  {key}
                </p>

                {/* Controls */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Move up (make primary)"
                    disabled={busy || i === 0}
                    onClick={() => handleMove(i, 'up')}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={busy || i === keys.length - 1}
                    onClick={() => handleMove(i, 'down')}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Replace image"
                    disabled={busy}
                    onClick={() => triggerUpload(i)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={busy}
                    onClick={() => handleDelete(i)}
                    className="p-1 rounded hover:bg-red-50 disabled:opacity-30 text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add slot */}
          <button
            type="button"
            disabled={busy}
            onClick={() => triggerUpload('add')}
            className="h-24 w-28 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600 transition disabled:opacity-50 flex-shrink-0"
          >
            {uploadingSlot === 'add' ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span className="text-xs">Add image</span>
              </>
            )}
          </button>
        </div>

        {error && <ErrorBox message={error} />}

        {/* Raw key editor — power user escape hatch */}
        <input
          className="input font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="R2 keys (comma-separated, auto-filled after upload)"
        />
      </div>
      {hint && <span className="block text-xs text-gray-400">{hint ?? 'Upload JPEG/PNG images (max 5MB each). First image is the hero shown in product cards. Use ↑↓ to reorder.'}</span>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleFileSelected(f); }}
      />
    </div>
  );
}
