'use client';

import clsx from 'clsx';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { NutritionRowDto, TemperatureBand } from '@/lib/catalogTypes';
import type { ProductFormState } from '@/components/catalog/productFormTypes';
import { TEMPERATURE_BAND_OPTIONS } from '@/lib/catalogTypes';
import { Field } from '@/components/ui';

const EMPTY_NUTRITION_ROW: NutritionRowDto = { nutrient: '', value: '', unit: '' };

/** Reference content — used for placeholders and optional sample fill. */
const SAMPLE: Pick<
  ProductFormState,
  | 'detailsAbout'
  | 'storageInstructions'
  | 'storageShelfLife'
  | 'storageUseByDate'
  | 'storageTemperatureBand'
  | 'nutritionServingSize'
  | 'nutritionRows'
> = {
  detailsAbout:
    'Sweet, crisp Gala apples sourced from fresh orchards. Naturally low in calories, rich in dietary fibre and vitamin C. Great eaten fresh, in salads, or juiced.',
  storageInstructions: 'Store in a cool, dry place or refrigerate for extended freshness.',
  storageShelfLife: '',
  storageUseByDate: '',
  storageTemperatureBand: 'AMBIENT',
  nutritionServingSize: '100 g',
  nutritionRows: [
    { nutrient: 'Energy', value: '52', unit: 'kcal' },
    { nutrient: 'Fat', value: '0.2', unit: 'g' },
    { nutrient: 'Carbohydrates', value: '13.8', unit: 'g' },
    { nutrient: 'Sugars', value: '10.4', unit: 'g' },
    { nutrient: 'Dietary Fibre', value: '2.4', unit: 'g' },
    { nutrient: 'Protein', value: '0.3', unit: 'g' },
    { nutrient: 'Vitamin C', value: '4.6', unit: 'mg' }
  ]
};

function isPdpEmpty(form: ProductFormState): boolean {
  return (
    !form.detailsAbout.trim() &&
    !form.storageInstructions.trim() &&
    !form.storageShelfLife.trim() &&
    !form.storageUseByDate.trim() &&
    !form.storageTemperatureBand &&
    !form.nutritionServingSize.trim() &&
    form.nutritionRows.length === 0
  );
}

interface PdpDetailsPanelProps {
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
}

export function PdpDetailsPanel({ form, setForm }: PdpDetailsPanelProps) {
  const [tipsOpen, setTipsOpen] = useState(false);

  function applySample() {
    setForm((f) => ({ ...f, ...SAMPLE, nutritionRows: SAMPLE.nutritionRows.map((r) => ({ ...r })) }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm leading-relaxed text-gray-500">
          Optional content for the customer product page — origin story, how to store, and nutrition per serving.
        </p>
        <button
          type="button"
          onClick={() => setTipsOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition hover:text-gray-600"
        >
          <ChevronDown className={clsx('h-3.5 w-3.5 transition', tipsOpen && 'rotate-180')} />
          Writing tips
        </button>
      </div>

      {tipsOpen && (
        <div className="grid gap-4 rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 sm:grid-cols-3">
          <TipBlock title="About" lines={['Two or three sentences.', 'Taste, source, and key benefits.', 'Avoid repeating the product title.']} />
          <TipBlock
            title="Storage"
            lines={[
              'Pick a use-by date when known, or describe shelf life in text.',
              'Add handling instructions (refrigerate after opening, etc.).',
              'Pick Ambient, Chilled, or Frozen.'
            ]}
          />
          <TipBlock
            title="Nutrition"
            lines={['State the serving size first.', 'One row per nutrient with value + unit.', 'Energy in kcal; macros in g.']}
          />
          {isPdpEmpty(form) && (
            <div className="sm:col-span-3 flex justify-end border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={applySample}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-green transition hover:text-brand-green-dark"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Prefill sample (Gala apple)
              </button>
            </div>
          )}
        </div>
      )}

      <section className="space-y-3">
        <SectionLabel>About</SectionLabel>
        <Field label="Product story" hint="Shown at the top of the product detail page.">
          <textarea
            className="input min-h-[96px] leading-relaxed"
            value={form.detailsAbout}
            onChange={(e) => setForm((f) => ({ ...f, detailsAbout: e.target.value }))}
            placeholder="Two or three sentences — taste, source, and key benefits…"
          />
        </Field>
      </section>

      <section className="space-y-3">
        <SectionLabel>Storage &amp; use by</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Use by date"
            hint="Optional fixed date (ISO). Leave blank if only a manual note applies."
          >
            <input
              type="date"
              className="input w-full max-w-xs"
              value={form.storageUseByDate}
              onChange={(e) => setForm((f) => ({ ...f, storageUseByDate: e.target.value }))}
            />
          </Field>
          <Field
            label="Use by / shelf life (manual)"
            hint='When there is no fixed date — e.g. "7 days", "Best before date on pack".'
          >
            <input
              className="input"
              value={form.storageShelfLife}
              onChange={(e) => setForm((f) => ({ ...f, storageShelfLife: e.target.value }))}
              placeholder="7 days"
            />
          </Field>
        </div>
        <Field label="Storage instructions" hint="How customers should store the product.">
          <input
            className="input"
            value={form.storageInstructions}
            onChange={(e) => setForm((f) => ({ ...f, storageInstructions: e.target.value }))}
            placeholder="Store in a cool, dry place or refrigerate…"
          />
        </Field>
        <Field label="Temperature band" hint="Matches how the product is stored and delivered.">
          <select
            className="input w-full max-w-xs"
            value={form.storageTemperatureBand}
            onChange={(e) => setForm((f) => ({ ...f, storageTemperatureBand: e.target.value as TemperatureBand | '' }))}
          >
            <option value="">Select…</option>
            {TEMPERATURE_BAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="space-y-3">
        <SectionLabel>Nutrition</SectionLabel>
        <Field label="Serving size" hint="All rows below are per this amount — e.g. 100 g.">
          <input
            className="input w-full max-w-xs"
            value={form.nutritionServingSize}
            onChange={(e) => setForm((f) => ({ ...f, nutritionServingSize: e.target.value }))}
            placeholder="100 g"
          />
        </Field>

        {form.nutritionRows.length === 0 ? (
          <p className="text-xs text-gray-400">No nutrients yet — add rows for Energy, Fat, Protein, and so on.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 font-medium">Nutrient</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {form.nutritionRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="p-2">
                      <input
                        className="input py-1.5"
                        value={row.nutrient}
                        onChange={(e) =>
                          setForm((f) => {
                            const rows = [...f.nutritionRows];
                            rows[i] = { ...rows[i], nutrient: e.target.value };
                            return { ...f, nutritionRows: rows };
                          })
                        }
                        placeholder="Energy"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-full min-w-[5rem] py-1.5"
                        value={row.value}
                        onChange={(e) =>
                          setForm((f) => {
                            const rows = [...f.nutritionRows];
                            rows[i] = { ...rows[i], value: e.target.value };
                            return { ...f, nutritionRows: rows };
                          })
                        }
                        placeholder="52"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-full min-w-[4rem] py-1.5"
                        value={row.unit ?? ''}
                        onChange={(e) =>
                          setForm((f) => {
                            const rows = [...f.nutritionRows];
                            rows[i] = { ...rows[i], unit: e.target.value };
                            return { ...f, nutritionRows: rows };
                          })
                        }
                        placeholder="kcal"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        onClick={() => setForm((f) => ({ ...f, nutritionRows: f.nutritionRows.filter((_, j) => j !== i) }))}
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          className="text-sm font-medium text-brand-green transition hover:text-brand-green-dark"
          onClick={() => setForm((f) => ({ ...f, nutritionRows: [...f.nutritionRows, { ...EMPTY_NUTRITION_ROW }] }))}
        >
          + Add nutrient
        </button>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h3>;
}

function TipBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-gray-600">{title}</p>
      <ul className="space-y-1 text-xs leading-relaxed text-gray-500">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export { EMPTY_NUTRITION_ROW };
