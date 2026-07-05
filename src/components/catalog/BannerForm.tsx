'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { BannerActionType, BannerResponse, CreateBannerRequest, UpdateBannerRequest } from '@/lib/catalogTypes';
import { BANNER_ACTION_TYPE_OPTIONS, slugifyBannerName } from '@/lib/catalogTypes';
import { ImageUploadField } from '@/components/catalog/ImageUploadField';
import { ActionItemPicker } from '@/components/catalog/ActionItemPicker';
import { ErrorBox, Field, Spinner } from '@/components/ui';

interface BannerFormState {
  slug: string;
  title: string;
  imageUrl: string;
  actionType: BannerActionType;
  actionItemIds: number[];
  isActive: boolean;
}

const EMPTY_FORM: BannerFormState = {
  slug: '',
  title: '',
  imageUrl: '',
  actionType: 'CATEGORY_LIST',
  actionItemIds: [],
  isActive: true
};

function bannerToForm(b: BannerResponse): BannerFormState {
  return {
    slug: b.slug,
    title: b.title,
    imageUrl: b.imageUrl,
    actionType: b.actionType,
    actionItemIds: b.actionItemIds ?? [],
    isActive: b.isActive
  };
}

interface BannerFormProps {
  editing?: BannerResponse;
}

export function BannerForm({ editing }: BannerFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<BannerFormState>(
    editing ? bannerToForm(editing) : EMPTY_FORM
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BannerFormState>(key: K, value: BannerFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const title = form.title.trim();
    const slug = form.slug.trim() || slugifyBannerName(title);
    const imageUrl = form.imageUrl.trim();

    if (!title) { setError('Title is required.'); return; }
    if (!slug) { setError('Slug is required.'); return; }
    if (!imageUrl) { setError('Upload a banner image first.'); return; }
    if (form.actionItemIds.length === 0) {
      setError(
        form.actionType === 'CATEGORY_LIST'
          ? 'Select at least one category.'
          : 'Select at least one product.'
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (editing) {
        const body: UpdateBannerRequest = {
          slug, title, imageUrl,
          actionType: form.actionType,
          actionItemIds: form.actionItemIds,
          isActive: form.isActive
        };
        await catalogApi.updateBanner(editing.id, body);
      } else {
        const body: CreateBannerRequest = {
          slug, title, imageUrl,
          actionType: form.actionType,
          actionItemIds: form.actionItemIds,
          isActive: form.isActive
        };
        await catalogApi.createBanner(body);
      }
      router.push('/catalog/banners');
      router.refresh();
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Failed to save banner.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && <ErrorBox message={error} />}

      <Field label="Title" hint="Screen header shown when the customer taps the banner.">
        <input
          className="input"
          value={form.title}
          autoFocus
          onChange={(e) => {
            const title = e.target.value;
            set('title', title);
            if (!editing) set('slug', form.slug || slugifyBannerName(title));
          }}
        />
      </Field>

      <Field label="Slug" hint="URL-friendly identifier. Auto-generated from title when creating.">
        <input
          className="input font-mono"
          value={form.slug}
          onChange={(e) => set('slug', e.target.value)}
        />
      </Field>

      <ImageUploadField
        scope="banner"
        slug={form.slug.trim() || slugifyBannerName(form.title)}
        label="Banner image"
        hint="Upload stores one R2 key under banners/{slug}/. Recommended ratio: 3:1 landscape."
        value={form.imageUrl}
        onChange={(v) => set('imageUrl', v)}
      />

      <Field label="Action type" hint="What opens when the customer taps this banner.">
        <select
          className="input"
          value={form.actionType}
          onChange={(e) => {
            set('actionType', e.target.value as BannerActionType);
            set('actionItemIds', []); // clear selection when type changes
          }}
        >
          {BANNER_ACTION_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>

      <Field
        label={form.actionType === 'CATEGORY_LIST' ? 'Categories (L2 / L3 only)' : 'Products'}
        hint={
          form.actionType === 'CATEGORY_LIST'
            ? 'Select the sub-categories or leaf categories to open. Top-level (L1) categories are excluded.'
            : 'Search and select the products to open.'
        }
      >
        <ActionItemPicker
          actionType={form.actionType}
          value={form.actionItemIds}
          onChange={(ids) => set('actionItemIds', ids)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        Active (banner can appear in schedules when assigned)
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create banner'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => router.push('/catalog/banners')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
