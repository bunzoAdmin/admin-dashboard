'use client';

import { useState } from 'react';
import { Barcode } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { BarcodeEntryResponse, CategoryTreeNode, ContentUom } from '@/lib/catalogTypes';
import { CONTENT_UOM_OPTIONS } from '@/lib/catalogTypes';
import { Card, ErrorBox, Field, Spinner } from '@/components/ui';
import { flattenCategories } from './barcodeUtils';

interface FormState {
  name: string;
  amount: string;
  uom: ContentUom;
  multipackCount: string;
  categoryId: string;
}

export function GenerateBarcodeForm({
  categories,
  onGenerated
}: {
  categories: CategoryTreeNode[];
  onGenerated: (entry: BarcodeEntryResponse) => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: '',
    amount: '',
    uom: 'G',
    multipackCount: '',
    categoryId: ''
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Content amount must be a positive number.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const entry = await catalogApi.generateBarcode({
        name: form.name.trim(),
        content: {
          amount,
          uom: form.uom,
          multipackCount: form.multipackCount ? parseInt(form.multipackCount, 10) : undefined
        },
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        format: 'EAN13'
      });
      onGenerated(entry);
    } catch (err) {
      setError(err instanceof CatalogApiError ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="space-y-4">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Product name"
          hint='e.g. "Tomato", "Banana", "Loose Spinach"'
          className="sm:col-span-2 lg:col-span-1"
        >
          <input
            className="input w-full"
            value={form.name}
            onChange={set('name')}
            placeholder="Tomato"
            required
          />
        </Field>

        <Field label="Content amount" hint="Numeric size of this variant, e.g. 500 or 1">
          <input
            className="input w-full"
            type="number"
            min={0.001}
            step="any"
            value={form.amount}
            onChange={set('amount')}
            placeholder="500"
            required
          />
        </Field>

        <Field label="Unit" hint="Unit of measure">
          <select className="input w-full" value={form.uom} onChange={set('uom')}>
            {CONTENT_UOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Multipack count"
          hint="Leave blank for single items. Set to 6 for a pack of 6."
        >
          <input
            className="input w-full"
            type="number"
            min={2}
            value={form.multipackCount}
            onChange={set('multipackCount')}
            placeholder="— single item —"
          />
        </Field>

        <Field
          label="Category"
          hint="Optional. Barcodes for the same category share a common prefix."
          className="sm:col-span-2 lg:col-span-1"
        >
          <select className="input w-full" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">— none —</option>
            {flattenCategories(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <div className="sm:col-span-2 lg:col-span-3">
            <ErrorBox message={error} />
          </div>
        )}

        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <button type="submit" className="btn-primary" disabled={generating}>
            {generating ? (
              <>
                <Spinner className="h-4 w-4" /> Generating…
              </>
            ) : (
              <>
                <Barcode className="h-4 w-4" /> Generate EAN-13
              </>
            )}
          </button>
        </div>
      </form>
    </Card>
  );
}
