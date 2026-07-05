'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type {
  BannerSlotResponse,
  CreateBannerSlotRequest,
  UpdateBannerSlotRequest
} from '@/lib/catalogTypes';
import { DAY_LABELS, slugifyBannerName } from '@/lib/catalogTypes';
import { ErrorBox, Field, Spinner } from '@/components/ui';

interface SlotFormState {
  name: string;
  slug: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority: string;
  isActive: boolean;
}

const EMPTY_FORM: SlotFormState = {
  name: '',
  slug: '',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '16:00',
  endTime: '21:00',
  priority: '0',
  isActive: true
};

function slotToForm(s: BannerSlotResponse): SlotFormState {
  return {
    name: s.name,
    slug: s.slug,
    daysOfWeek: s.daysOfWeek,
    startTime: s.startTime?.slice(0, 5) ?? '',
    endTime: s.endTime?.slice(0, 5) ?? '',
    priority: String(s.priority ?? 0),
    isActive: s.isActive
  };
}

interface SlotFormProps {
  editing?: BannerSlotResponse;
}

export function SlotForm({ editing }: SlotFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<SlotFormState>(editing ? slotToForm(editing) : EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SlotFormState>(key: K, value: SlotFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day].sort((a, b) => a - b)
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const name = form.name.trim();
    const slug = form.slug.trim() || slugifyBannerName(name);
    const priority = parseInt(form.priority, 10);

    if (!name) { setError('Name is required.'); return; }
    if (!slug) { setError('Slug is required.'); return; }
    if (form.daysOfWeek.length === 0) { setError('Select at least one day.'); return; }
    if (!form.startTime || !form.endTime) { setError('Start and end times are required.'); return; }
    if (form.startTime >= form.endTime) { setError('Start time must be before end time.'); return; }
    if (!Number.isFinite(priority) || priority < 0) { setError('Priority must be a non-negative integer.'); return; }

    setBusy(true);
    setError(null);

    try {
      if (editing) {
        const body: UpdateBannerSlotRequest = {
          name, slug,
          daysOfWeek: form.daysOfWeek,
          startTime: form.startTime + ':00',
          endTime: form.endTime + ':00',
          priority,
          isActive: form.isActive
        };
        await catalogApi.updateBannerSlot(editing.id, body);
        router.push(`/catalog/slots/${editing.id}`);
      } else {
        const body: CreateBannerSlotRequest = {
          name, slug,
          daysOfWeek: form.daysOfWeek,
          startTime: form.startTime + ':00',
          endTime: form.endTime + ':00',
          priority,
          isActive: form.isActive
        };
        const created = await catalogApi.createBannerSlot(body);
        router.push(`/catalog/slots/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Failed to save slot.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && <ErrorBox message={error} />}

      <Field label="Name" hint='Human label shown in the dashboard, e.g. "Evening Deals".'>
        <input
          className="input"
          value={form.name}
          autoFocus
          onChange={(e) => {
            const name = e.target.value;
            set('name', name);
            if (!editing) set('slug', form.slug || slugifyBannerName(name));
          }}
        />
      </Field>

      <Field label="Slug" hint="URL-friendly key. Auto-generated from name when creating.">
        <input
          className="input font-mono"
          value={form.slug}
          onChange={(e) => set('slug', e.target.value)}
        />
      </Field>

      {/* Day-of-week selector */}
      <div className="space-y-1.5">
        <span className="label">Active days <span className="text-xs text-gray-400">(Africa/Lusaka time)</span></span>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map(({ value, short }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleDay(value)}
              className={[
                'h-9 w-12 rounded-lg border text-sm font-medium transition',
                form.daysOfWeek.includes(value)
                  ? 'border-brand-green bg-brand-green text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              ].join(' ')}
            >
              {short}
            </button>
          ))}
        </div>
        {form.daysOfWeek.length === 0 && (
          <p className="text-xs text-red-500">Select at least one day.</p>
        )}
      </div>

      {/* Time range */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start time" hint="CAT (Africa/Lusaka)">
          <input
            type="time"
            className="input"
            value={form.startTime}
            onChange={(e) => set('startTime', e.target.value)}
          />
        </Field>
        <Field label="End time" hint="CAT (Africa/Lusaka)">
          <input
            type="time"
            className="input"
            value={form.endTime}
            onChange={(e) => set('endTime', e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Priority"
        hint="When multiple active slots overlap, highest priority wins. Tie → newest slot wins. Default 0."
      >
        <input
          type="number"
          min={0}
          className="input w-32"
          value={form.priority}
          onChange={(e) => set('priority', e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        Active (slot participates in scheduling)
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Create slot'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => router.push(editing ? `/catalog/slots/${editing.id}` : '/catalog/slots')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
