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
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);
  const [pendingFromBrowse, setPendingFromBrowse] = useState(false);
  const [returnToBrowse, setReturnToBrowse] = useState(false);

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
    setReturnToBrowse(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 0);
  }, []);

  const closeEditor = useCallback(() => {
    if (returnToBrowse) {
      router.push('/catalog/products/browse');
      return;
    }
    resetForNextScan();
  }, [returnToBrowse, resetForNextScan, router]);

  const lookupByProductId = useCallback(async (id: number, fromBrowse = false) => {
    setLookingUp(true);
    setLookupError(null);
    setLockedBarcode(null);
    setBarcodeInput('');

    try {
      const found = await catalogApi.getAdminProductById(id);
      setProduct(found);
      setLockedBarcode(found.barcode?.trim() || null);
      setBarcodeInput(found.barcode?.trim() ?? '');
      setMode('edit');
      setReturnToBrowse(fromBrowse);
    } catch (err) {
      setLookupError(err instanceof CatalogApiError ? err.message : 'Failed to load product.');
      setProduct(null);
      setMode(null);
      setLockedBarcode(null);
      setReturnToBrowse(false);
    } finally {
      setLookingUp(false);
    }
  }, []);

  const lookupBarcode = useCallback(
    async (raw: string, fromBrowse = false) => {
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
        setReturnToBrowse(fromBrowse);
      } catch (err) {
        setReturnToBrowse(false);
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
    const fromBrowse = searchParams.get('from') === 'browse';
    const fromQuery = searchParams.get('barcode')?.trim();
    const idParam = searchParams.get('id')?.trim();
    if (fromQuery) {
      lookupBarcode(fromQuery, fromBrowse);
      router.replace('/catalog/products', { scroll: false });
    } else if (idParam) {
      const id = parseInt(idParam, 10);
      if (Number.isFinite(id)) {
        setPendingFromBrowse(fromBrowse);
        setPendingProductId(id);
        router.replace('/catalog/products', { scroll: false });
      }
    }
  }, [searchParams, lookupBarcode, router]);

  // Browse → Edit passes ?id=… when the product has no barcode.
  useEffect(() => {
    if (pendingProductId == null) return;
    const id = pendingProductId;
    const fromBrowse = pendingFromBrowse;
    setPendingProductId(null);
    setPendingFromBrowse(false);
    lookupByProductId(id, fromBrowse);
  }, [pendingProductId, pendingFromBrowse, lookupByProductId]);

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

        {mode && (
          <button type="button" className="text-sm text-gray-500 underline hover:text-gray-700" onClick={closeEditor}>
            {returnToBrowse ? 'Back to browse' : lockedBarcode ? 'Scan another barcode' : 'Close editor'}
          </button>
        )}
      </Card>

      {lookupError && <ErrorBox message={lookupError} />}

      {mode && (lockedBarcode || product) && (
        <ProductEditor
          mode={mode}
          barcode={lockedBarcode ?? product?.barcode?.trim() ?? ''}
          product={product}
          categories={categories}
          onSaved={closeEditor}
          onCancel={closeEditor}
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
