'use client';

import { Suspense, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { ScanBarcode, Search } from 'lucide-react';
import { catalogApi, CatalogApiError, isCatalogNotFound } from '@/lib/catalogApi';
import type { ProductResponse } from '@/lib/catalogTypes';
import { InventoryOpsPanel } from '@/components/inventory/InventoryOpsPanel';
import { ProductPicker, ProductSummary } from '@/components/inventory/ProductPicker';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Card, ErrorBox, Field, Loading, Spinner } from '@/components/ui';

export default function InventoryPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageContent() {
  const barcodeRef = useRef<HTMLInputElement>(null);
  const { storeId, setStoreId } = useStoreContext();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const reset = useCallback(() => {
    setProduct(null);
    setBarcodeInput('');
    setLookupError(null);
    setShowPicker(false);
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }, []);

  const selectProduct = useCallback((p: ProductResponse) => {
    setProduct(p);
    setShowPicker(false);
    setLookupError(null);
    if (p.barcode) setBarcodeInput(p.barcode);
  }, []);

  const lookupBarcode = useCallback(async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;

    setLookingUp(true);
    setLookupError(null);
    setShowPicker(false);
    setBarcodeInput(barcode);

    try {
      const found = await catalogApi.getProductByBarcode(barcode);
      setProduct(found);
    } catch (err) {
      setProduct(null);
      if (isCatalogNotFound(err)) {
        setLookupError('No product with this barcode. Find one below or add it in Catalog → Products.');
        setShowPicker(true);
      } else {
        setLookupError(err instanceof CatalogApiError ? err.message : 'Lookup failed.');
      }
    } finally {
      setLookingUp(false);
    }
  }, []);

  function onBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupBarcode(barcodeInput);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory inwarding</h1>
          <p className="text-sm text-gray-500">Scan a product, then add or transfer stock at a store.</p>
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {!product && (
        <Card className="max-w-xl space-y-4">
          <Field label="Barcode" hint="Scan with your reader, or type and press Enter.">
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                autoFocus
                className="input flex-1 font-mono"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={onBarcodeKeyDown}
                placeholder="Scan or enter barcode…"
                disabled={lookingUp}
              />
              <button
                type="button"
                className="btn-primary shrink-0"
                disabled={lookingUp || !barcodeInput.trim()}
                onClick={() => lookupBarcode(barcodeInput)}
              >
                {lookingUp ? <Spinner className="h-4 w-4" /> : <ScanBarcode className="h-4 w-4" />}
                Look up
              </button>
            </div>
          </Field>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
            onClick={() => {
              setShowPicker((v) => !v);
              setLookupError(null);
            }}
          >
            <Search className="h-4 w-4" />
            {showPicker ? 'Hide product search' : 'Find product without barcode'}
          </button>
        </Card>
      )}

      {lookupError && !product && <ErrorBox message={lookupError} />}

      {showPicker && !product && storeId != null && <ProductPicker storeId={storeId} onSelect={selectProduct} />}

      {product && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <ProductSummary product={product} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={reset}>
                Scan another product
              </button>
              {!product.barcode && (
                <Link href="/catalog/products" className="btn-ghost text-sm">
                  Add barcode in Catalog
                </Link>
              )}
            </div>
          </Card>
          {storeId != null && <InventoryOpsPanel product={product} storeId={storeId} />}
        </div>
      )}
    </div>
  );
}
