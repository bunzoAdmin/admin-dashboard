'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanBarcode, Search } from 'lucide-react';
import { catalogApi, CatalogApiError, isCatalogNotFound } from '@/lib/catalogApi';
import type { ProductResponse } from '@/lib/catalogTypes';
import { ProductPicker, ProductSummary } from '@/components/inventory/ProductPicker';
import { StoreSelector, INWARDING_EXCLUDED_STORE_IDS, useStoreContext } from '@/components/pickers/StoreSelector';
import { inventoryApi, InventoryApiError } from '@/lib/inventoryApi';
import type { InventoryBinResponse } from '@/lib/inventoryTypes';
import { zraApi, ZraApiError, type ZraDisposeRequest, type ZraDisposeResult } from '@/lib/zraApi';
import { useZraFinanceAccess } from '@/lib/useZraFinanceAccess';
import { ZraFinanceNotice } from '@/components/zra/ZraFinanceNotice';
import { Card, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

const PENDING_DISPOSE_KEY = 'bunzo.dispose.pending';

type PendingDispose = {
  key: string;
  storeId: number;
  product: ProductResponse;
  storeroom: boolean;
  location: string;
  qty: string;
  reason: string;
  note: string;
};

const REASONS = [
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'SPOILAGE', label: 'Spoilage' },
  { value: 'QUALITY', label: 'Quality reject' }
] as const;

export default function DisposeStockPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <DisposeStockPageContent />
    </Suspense>
  );
}

function DisposeStockPageContent() {
  const toast = useToast();
  const finance = useZraFinanceAccess();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const { storeId, setStoreId } = useStoreContext();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [bins, setBins] = useState<InventoryBinResponse[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);
  const [binsError, setBinsError] = useState<string | null>(null);
  const [storeroom, setStoreroom] = useState(true);
  const [location, setLocation] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [zraRetry, setZraRetry] = useState<ZraDisposeResult | null>(null);
  const [payloadLocked, setPayloadLocked] = useState(false);
  const locked = payloadLocked || zraRetry != null;

  const binLocation = storeroom ? 'STOREROOM' : location.trim().toUpperCase();
  const selectedBin = useMemo(
    () => bins.find((b) => b.locationCode === binLocation) ?? null,
    [bins, binLocation]
  );
  const available = selectedBin?.availableStock ?? 0;
  const parsedQty = parseInt(qty, 10);

  const clearAttempt = useCallback(() => {
    idempotencyKey.current = null;
    setPayloadLocked(false);
    sessionStorage.removeItem(PENDING_DISPOSE_KEY);
  }, []);

  const rememberAttempt = useCallback((pending: PendingDispose) => {
    idempotencyKey.current = pending.key;
    setPayloadLocked(true);
    sessionStorage.setItem(PENDING_DISPOSE_KEY, JSON.stringify(pending));
  }, []);

  const loadBins = useCallback(async (sku: string, sid: number) => {
    setBins([]);
    setLoadingBins(true);
    setBinsError(null);
    try {
      setBins(await inventoryApi.getBins(sid, sku));
    } catch (err) {
      setBins([]);
      setBinsError(err instanceof InventoryApiError ? err.message : 'Could not load stock.');
    } finally {
      setLoadingBins(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProduct(null);
    setBarcodeInput('');
    setLookupError(null);
    setShowPicker(false);
    setBins([]);
    setQty('');
    setNote('');
    setConfirmed(false);
    setFormError(null);
    setZraRetry(null);
    clearAttempt();
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }, [clearAttempt]);

  const selectProduct = useCallback((p: ProductResponse) => {
    setProduct(p);
    setShowPicker(false);
    setLookupError(null);
    setQty('');
    setConfirmed(false);
    setFormError(null);
    setZraRetry(null);
    clearAttempt();
    if (p.barcode) setBarcodeInput(p.barcode);
    if (storeId != null) loadBins(p.sku, storeId);
  }, [clearAttempt, loadBins, storeId]);

  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_DISPOSE_KEY);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as PendingDispose;
      if (!pending.key || !pending.product?.sku || pending.storeId == null) {
        sessionStorage.removeItem(PENDING_DISPOSE_KEY);
        return;
      }
      idempotencyKey.current = pending.key;
      setProduct(pending.product);
      setStoreroom(pending.storeroom);
      setLocation(pending.location ?? '');
      setQty(pending.qty ?? '');
      setReason(pending.reason || REASONS[0].value);
      setNote(pending.note ?? '');
      setConfirmed(true);
      setPayloadLocked(true);
      setStoreId(pending.storeId);
      setFormError('This dispose attempt is still open. Retry uses the same request, so stock is removed only once.');
      if (pending.product.barcode) setBarcodeInput(pending.product.barcode);
      loadBins(pending.product.sku, pending.storeId);
    } catch {
      sessionStorage.removeItem(PENDING_DISPOSE_KEY);
    }
  }, [loadBins, setStoreId]);

  const lookupBarcode = useCallback(async (raw: string) => {
    const barcode = raw.trim();
    if (!barcode) return;
    setLookingUp(true);
    setLookupError(null);
    setShowPicker(false);
    setBarcodeInput(barcode);
    try {
      selectProduct(await catalogApi.getProductByBarcode(barcode));
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
  }, [selectProduct]);

  function reasonText() {
    const extra = note.trim();
    return extra ? `${reason}: ${extra}` : reason;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || storeId == null) return;
    if (zraRetry) {
      await retryZra();
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setFormError('Enter a positive quantity.');
      return;
    }
    if (!storeroom && !location.trim()) {
      setFormError('Enter a shelf location or use storeroom.');
      return;
    }
    if (!selectedBin) {
      setFormError(`No stock at ${binLocation}.`);
      return;
    }
    if (!payloadLocked && parsedQty > available) {
      setFormError(`Cannot dispose more than ${available} unreserved units (${selectedBin.reservedStock} reserved).`);
      return;
    }
    if (!confirmed) {
      setFormError('Confirm that this stock should be removed from Bunzo and ZRA.');
      return;
    }

    if (finance.loading || !finance.allowed) {
      setFormError('Only a ZRA finance admin can dispose stock.');
      return;
    }

    const key = idempotencyKey.current ?? crypto.randomUUID();
    const body: ZraDisposeRequest = {
      storeId,
      sku: product.sku,
      quantity: parsedQty,
      expectedCurrentStock: selectedBin.currentStock,
      reason: reasonText(),
      itemName: product.name,
      storeroom,
      locationCode: storeroom ? undefined : location.trim()
    };
    rememberAttempt({
      key,
      storeId,
      product,
      storeroom,
      location,
      qty,
      reason,
      note
    });
    setBusy(true);
    setFormError(null);
    try {
      const res = await zraApi.disposeStock(body, key, finance.username ?? undefined);
      report(res);
    } catch (err) {
      const msg = err instanceof ZraApiError ? err.message : 'Dispose failed.';
      setFormError(msg);
      const status = err instanceof ZraApiError ? err.status : 0;
      const rejected = status === 400 || status === 403 || status === 404
        || (status === 409 && (msg.includes('changed from') || msg.includes('refresh')));
      if (rejected) {
        clearAttempt();
        if (msg.includes('changed from') || msg.includes('refresh')) loadBins(product.sku, storeId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryZra() {
    if (!product || storeId == null || !zraRetry || !idempotencyKey.current) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await zraApi.disposeStock({
        storeId: zraRetry.storeId ?? storeId,
        sku: product.sku,
        quantity: zraRetry.quantityDisposed ?? parsedQty,
        expectedCurrentStock: zraRetry.newCurrentStock ?? selectedBin?.currentStock ?? 0,
        reason: reasonText(),
        itemName: product.name,
        storeroom,
        locationCode: storeroom ? undefined : location.trim()
      }, idempotencyKey.current, finance.username ?? undefined);
      report(res);
    } catch (err) {
      setFormError(err instanceof ZraApiError ? err.message : 'ZRA retry failed.');
    } finally {
      setBusy(false);
    }
  }

  function report(res: ZraDisposeResult) {
    const removed = res.quantityDisposed ?? parsedQty;
    const where = res.locationCode ?? binLocation;
    if (res.zraStatus === 'SUCCEEDED') {
      toast.push(
        'success',
        res.zraAlreadyPosted
          ? `ZRA already had this disposal. ${where} is at ${res.newCurrentStock}.`
          : `Disposed ${removed} from ${where}. ZRA stock reduced (discarding, code ${res.sarTyCd ?? '15'}).`
      );
      setQty('');
      setNote('');
      setConfirmed(false);
      setZraRetry(null);
      clearAttempt();
    } else if (res.zraStatus === 'SKIPPED') {
      toast.push('info', `Disposed ${removed} from ${where}. ${res.zraMessage ?? 'ZRA was not updated.'} Retry sends this disposal to ZRA only.`);
      setFormError(res.zraMessage ?? 'ZRA was not updated.');
      setZraRetry(res);
    } else {
      toast.push('info', `Disposed ${removed} from ${where}. ZRA sync failed — retry without removing more stock.`);
      setFormError(res.zraMessage ?? 'ZRA sync failed.');
      setZraRetry(res);
    }
    if (product && storeId != null) loadBins(product.sku, storeId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dispose stock</h1>
        <p className="text-sm text-gray-500">
          Removes unreserved units from a bin and posts the same quantity to ZRA as a discarding stock-out.
          Units reserved for open orders stay in place.
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <StoreSelector
          storeId={storeId}
          onStoreChange={(id) => {
            if (locked) return;
            setStoreId(id);
            if (product && id != null) loadBins(product.sku, id);
          }}
          excludeStoreIds={INWARDING_EXCLUDED_STORE_IDS}
        />
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    lookupBarcode(barcodeInput);
                  }
                }}
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
            <button type="button" className="btn-ghost text-sm" onClick={reset} disabled={locked}>
              Scan another product
            </button>
          </Card>

          <Card>
            <form onSubmit={submit} className="space-y-4">
              {binsError && <ErrorBox message={binsError} />}
              {formError && <ErrorBox message={formError} />}
              <ZraFinanceNotice access={finance} />

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={storeroom}
                  disabled={locked}
                  onChange={(e) => {
                    setStoreroom(e.target.checked);
                    setConfirmed(false);
                  }}
                />
                Storeroom bin
              </label>
              {!storeroom && (
                <Field label="Shelf location">
                  <input
                    className="input max-w-xs font-mono uppercase"
                    value={location}
                    disabled={locked}
                    onChange={(e) => {
                      setLocation(e.target.value.toUpperCase());
                      setConfirmed(false);
                    }}
                    placeholder="A1-S3"
                    list="dispose-bin-options"
                  />
                </Field>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-mono text-xs uppercase tracking-wide text-gray-400">{binLocation || 'Select bin'}</p>
                {loadingBins ? (
                  <p className="mt-1 text-gray-500">Loading stock…</p>
                ) : selectedBin ? (
                  <p className="mt-1 text-gray-700">
                    <span className="font-semibold text-gray-900">{available}</span> can be disposed
                    <span className="text-gray-500"> ({selectedBin.currentStock} on hand, {selectedBin.reservedStock} reserved)</span>
                  </p>
                ) : (
                  <p className="mt-1 text-amber-700">No stock record at this bin.</p>
                )}
              </div>

              <Field
                label="Quantity to dispose"
                hint={available > 0 ? `Max ${available} unreserved units.` : 'Select a bin with available stock.'}
              >
                <input
                  className="input w-32"
                  type="number"
                  min="1"
                  max={available > 0 ? available : undefined}
                  value={qty}
                  disabled={locked || available <= 0}
                  onChange={(e) => {
                    setQty(e.target.value);
                    setConfirmed(false);
                  }}
                  required
                />
              </Field>

              <Field label="Reason">
                <select
                  className="input max-w-xs"
                  value={reason}
                  disabled={locked}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Note" hint="Optional. Sent with the reason on the ZRA stock movement.">
                <input
                  className="input max-w-md"
                  value={note}
                  maxLength={200}
                  disabled={locked}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Batch date, damage detail…"
                />
              </Field>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Remove this stock from Bunzo and from ZRA. This cannot be undone from this screen.
              </label>

              {zraRetry && (
                <p className="text-sm text-gray-600">
                  Bunzo stock is already reduced. Retry only sends this disposal to ZRA.
                </p>
              )}

              <button
                type="submit"
                className="btn-danger"
                disabled={busy || loadingBins || finance.loading || !finance.allowed || (!zraRetry && !payloadLocked && available <= 0)}
              >
                {busy ? <Spinner className="h-4 w-4" /> : zraRetry ? 'Retry ZRA sync' : 'Dispose stock'}
              </button>
            </form>
          </Card>

          <datalist id="dispose-bin-options">
            {bins
              .filter((b) => b.locationCode !== 'STOREROOM')
              .map((b) => (
                <option key={b.locationCode} value={b.locationCode} />
              ))}
          </datalist>
        </div>
      )}
    </div>
  );
}
