'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MapPin, ScanBarcode } from 'lucide-react';
import { inventoryHealthApi, InventoryHealthApiError } from '@/lib/inventoryHealthApi';
import type { LocationStockResponse } from '@/lib/inventoryHealthTypes';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Spinner } from '@/components/ui';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

export default function LocationAuditPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <LocationAuditPageContent />
    </Suspense>
  );
}

function LocationAuditPageContent() {
  const locationRef = useRef<HTMLInputElement>(null);
  const { storeId, setStoreId } = useStoreContext();

  const [locationInput, setLocationInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LocationStockResponse | null>(null);
  const [history, setHistory] = useState<LocationStockResponse[]>([]);

  const focusInput = useCallback(() => {
    setTimeout(() => locationRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput, storeId]);

  const lookupLocation = useCallback(
    async (raw: string) => {
      const locationCode = raw.trim();
      if (!locationCode || storeId == null) return;

      setLookingUp(true);
      setLookupError(null);
      setLocationInput(locationCode);

      try {
        const data = await inventoryHealthApi.getStockByLocation(storeId, locationCode);
        setResult(data);
        setHistory((prev) => [data, ...prev.filter((h) => h.locationCode !== data.locationCode)].slice(0, 10));
        setLocationInput('');
        focusInput();
      } catch (err) {
        setResult(null);
        setLookupError(
          err instanceof InventoryHealthApiError ? err.message : 'Location lookup failed.'
        );
        focusInput();
      } finally {
        setLookingUp(false);
      }
    },
    [storeId, focusInput]
  );

  function onLocationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupLocation(locationInput);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Location audit</h1>
          <p className="text-sm text-gray-500">
            Scan a shelf barcode or type a location code to see what stock the system expects on that
            rack. Use a USB scanner — it types the code and sends Enter automatically.
          </p>
        </div>
        <Link href="/barcode-generator/generate" className="btn-ghost text-sm">
          Print rack labels
        </Link>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {storeId == null ? (
        <EmptyState>Select a store above to start auditing.</EmptyState>
      ) : (
        <>
          <Card className="max-w-xl space-y-4">
            <Field
              label="Shelf location"
              hint="Scan rack sticker (CODE128) or type e.g. A1-01-F1-A, then press Enter."
            >
              <div className="flex gap-2">
                <input
                  ref={locationRef}
                  autoFocus
                  className="input flex-1 font-mono uppercase"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={onLocationKeyDown}
                  placeholder="Scan or enter location…"
                  disabled={lookingUp}
                />
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={lookingUp || !locationInput.trim()}
                  onClick={() => lookupLocation(locationInput)}
                >
                  {lookingUp ? <Spinner className="h-4 w-4" /> : <ScanBarcode className="h-4 w-4" />}
                  Look up
                </button>
              </div>
            </Field>
          </Card>

          {lookupError && <ErrorBox message={lookupError} />}

          {lookingUp && <Loading label="Looking up location…" />}

          {result && !lookingUp && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-green-dark" />
                  <h2 className="text-base font-semibold text-gray-900 font-mono">{result.locationCode}</h2>
                </div>
                <p className="text-sm text-gray-500">
                  {result.totalSkus} SKU{result.totalSkus !== 1 ? 's' : ''} · {result.totalUnits} unit
                  {result.totalUnits !== 1 ? 's' : ''} on shelf
                </p>
              </div>

              {result.items.length === 0 ? (
                <EmptyState>
                  No stock recorded at this location — the shelf should be empty.
                </EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium">SKU</th>
                        <th className="px-4 py-3 font-medium">Barcode</th>
                        <th className="px-4 py-3 font-medium">On shelf</th>
                        <th className="px-4 py-3 font-medium">Reserved</th>
                        <th className="px-4 py-3 font-medium">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item) => (
                        <tr key={item.inventoryItemId} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.sku}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.barcode ?? '—'}</td>
                          <td className="px-4 py-3">{item.currentStock}</td>
                          <td className="px-4 py-3 text-gray-500">{item.reservedStock}</td>
                          <td className="px-4 py-3">
                            <Badge
                              tone={
                                item.availableStock <= 0
                                  ? 'red'
                                  : item.availableStock < item.currentStock
                                    ? 'amber'
                                    : 'green'
                              }
                            >
                              {item.availableStock}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Count items on the shelf and compare with the table above. Scan the next location when
                ready — the input stays focused for continuous auditing.
              </p>
            </Card>
          )}

          {history.length > 1 && (
            <Card className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Recent locations this session</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {history.slice(1).map((entry) => (
                  <li key={entry.locationCode} className="font-mono text-xs">
                    {entry.locationCode} — {entry.totalSkus} SKU{entry.totalSkus !== 1 ? 's' : ''},{' '}
                    {entry.totalUnits} units
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
