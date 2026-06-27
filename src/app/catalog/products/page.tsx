'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ScanBarcode } from 'lucide-react';
import { catalogApi, CatalogApiError, isCatalogNotFound } from '@/lib/catalogApi';
import type { CategoryTreeNode, ProductResponse } from '@/lib/catalogTypes';
import { ProductEditor, type ProductEditorMode } from '@/components/catalog/ProductEditor';
import { Card, ErrorBox, Field, Loading, Spinner } from '@/components/ui';

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [lockedBarcode, setLockedBarcode] = useState<string | null>(null);
  const [mode, setMode] = useState<ProductEditorMode | null>(null);
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await catalogApi.getCategoryTree());
    } catch {
      // non-fatal — form still works if categories fail
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const resetForNextScan = useCallback(() => {
    setLockedBarcode(null);
    setMode(null);
    setProduct(null);
    setBarcodeInput('');
    setLookupError(null);
    setTimeout(() => barcodeInputRef.current?.focus(), 0);
  }, []);

  const lookupBarcode = useCallback(
    async (raw: string) => {
      const barcode = raw.trim();
      if (!barcode) return;

      setLookingUp(true);
      setLookupError(null);
      setLockedBarcode(barcode);
      setBarcodeInput(barcode);

      try {
        const found = await catalogApi.getProductByBarcode(barcode);
        setProduct(found);
        setMode('edit');
      } catch (err) {
        if (isCatalogNotFound(err)) {
          setProduct(null);
          setMode('create');
        } else {
          setLookupError(err instanceof CatalogApiError ? err.message : 'Lookup failed.');
          setLockedBarcode(null);
          setMode(null);
        }
      } finally {
        setLookingUp(false);
      }
    },
    []
  );

  useEffect(() => {
    const fromQuery = searchParams.get('barcode')?.trim();
    if (fromQuery) {
      lookupBarcode(fromQuery);
      router.replace('/catalog/products', { scroll: false });
    }
  }, [searchParams, lookupBarcode, router]);

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
          <h1 className="text-xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Scan a barcode to look up or create a product, then save via sync.</p>
        </div>
        <Link href="/catalog/products/browse" className="btn-ghost text-sm">
          Browse all products
        </Link>
      </div>

      <Card className="max-w-xl space-y-4">
        <Field label="Barcode" hint="Focus here and scan with your barcode reader, or type and press Enter.">
          <div className="flex gap-2">
            <input
              ref={barcodeInputRef}
              autoFocus
              className="input flex-1 font-mono"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={onBarcodeKeyDown}
              placeholder="Scan or enter barcode…"
              disabled={lookingUp || (lockedBarcode != null && mode != null)}
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

        {lockedBarcode && mode && (
          <button type="button" className="text-sm text-gray-500 underline hover:text-gray-700" onClick={resetForNextScan}>
            Scan another barcode
          </button>
        )}
      </Card>

      {lookupError && <ErrorBox message={lookupError} />}

      {lockedBarcode && mode && (
        <ProductEditor
          mode={mode}
          barcode={lockedBarcode}
          product={product}
          categories={categories}
          onSaved={resetForNextScan}
          onCancel={resetForNextScan}
        />
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <ProductsPageContent />
    </Suspense>
  );
}
