'use client';

import { useState } from 'react';
import { Barcode, Download } from 'lucide-react';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import { Card, ErrorBox, Field, Spinner } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import {
  parseRackCodesInput,
  toRackBarcodeEntry,
  type BarcodeDisplayEntry
} from './barcodeUtils';

export function GenerateRackBarcodeForm({
  onGenerated
}: {
  onGenerated: (entries: BarcodeDisplayEntry[]) => void;
}) {
  const { storeId, setStoreId } = useStoreContext();
  const [codes, setCodes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const normalized = parseRackCodesInput(codes);
      onGenerated(normalized.map(toRackBarcodeEntry));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate rack labels.');
    } finally {
      setGenerating(false);
    }
  }

  async function loadFromStore() {
    if (storeId == null) {
      setError('Select a store first.');
      return;
    }
    setLoadingLocations(true);
    setError(null);
    try {
      const data = await inventoryHealthApi.listShelfLocations(storeId);
      if (data.locations.length === 0) {
        setError('No locations with stock history found for this store.');
        return;
      }
      const locationCodes = data.locations.map((l) => l.locationCode).join('\n');
      setCodes(locationCodes);
      onGenerated(data.locations.map((l) => toRackBarcodeEntry(l.locationCode)));
    } catch (err) {
      setError(err instanceof InventoryHealthApiError ? err.message : 'Failed to load locations.');
    } finally {
      setLoadingLocations(false);
    }
  }

  return (
    <Card className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
          <button
            type="button"
            className="btn-ghost flex items-center gap-1.5 text-sm"
            disabled={loadingLocations || storeId == null}
            onClick={loadFromStore}
          >
            {loadingLocations ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Load locations with stock history
          </button>
        </div>

        <Field
          label="Shelf location codes"
          hint='Type or paste codes manually (one per line) — use this for new racks before any stock is inwarded. Or load locations that already have stock history above. Codes are uppercased on labels; CODE128 stickers scan back into Location audit.'
        >
          <textarea
            className="input min-h-32 w-full font-mono text-sm"
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            placeholder={'A1-01-F1-A\nA1-01-F1-B\nA1-01-F1-C'}
          />
        </Field>

        {error && <ErrorBox message={error} />}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={generating || !codes.trim()}>
            {generating ? (
              <>
                <Spinner className="h-4 w-4" /> Generating…
              </>
            ) : (
              <>
                <Barcode className="h-4 w-4" /> Generate rack labels
              </>
            )}
          </button>
        </div>
      </form>
    </Card>
  );
}
