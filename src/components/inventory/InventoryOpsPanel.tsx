'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, PackagePlus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { inventoryApi, InventoryApiError } from '@/lib/inventoryApi';
import type { InventoryBinResponse, ProductAvailability } from '@/lib/inventoryTypes';
import type { ProductResponse } from '@/lib/catalogTypes';
import { Badge, Card, ErrorBox, Field, Spinner, Stat, useToast } from '@/components/ui';

type OpTab = 'add' | 'transfer' | 'adjust';

interface InventoryOpsPanelProps {
  product: ProductResponse;
  storeId: number;
  onStockChanged?: () => void;
}

export function InventoryOpsPanel({ product, storeId, onStockChanged }: InventoryOpsPanelProps) {
  const toast = useToast();
  const [tab, setTab] = useState<OpTab>('add');
  const [availability, setAvailability] = useState<ProductAvailability | null>(null);
  const [bins, setBins] = useState<InventoryBinResponse[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);

  const [addQty, setAddQty] = useState('');
  const [addStoreroom, setAddStoreroom] = useState(true);
  const [addLocation, setAddLocation] = useState('');
  const [addReason, setAddReason] = useState('INWARDING');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [xferQty, setXferQty] = useState('');
  const [fromStoreroom, setFromStoreroom] = useState(true);
  const [fromLocation, setFromLocation] = useState('');
  const [toStoreroom, setToStoreroom] = useState(false);
  const [toLocation, setToLocation] = useState('');
  const [xferReason, setXferReason] = useState('REPLENISH_SHELF');
  const [xferBusy, setXferBusy] = useState(false);
  const [xferError, setXferError] = useState<string | null>(null);

  const [adjustStoreroom, setAdjustStoreroom] = useState(true);
  const [adjustLocation, setAdjustLocation] = useState('');
  const [adjustReason, setAdjustReason] = useState('CORRECTION');
  const [adjustTarget, setAdjustTarget] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const selectedBinLocation = adjustStoreroom ? 'STOREROOM' : adjustLocation.trim().toUpperCase();

  const selectedBin = useMemo(
    () => bins.find((b) => b.locationCode === selectedBinLocation) ?? null,
    [bins, selectedBinLocation]
  );

  const selectedCurrent = selectedBin?.currentStock ?? 0;
  const selectedReserved = selectedBin?.reservedStock ?? 0;
  const parsedTarget = parseInt(adjustTarget, 10);
  const targetValid = Number.isFinite(parsedTarget) && parsedTarget >= 0;
  const adjustDelta = targetValid ? parsedTarget - selectedCurrent : null;

  const fromBinLocation = fromStoreroom ? 'STOREROOM' : fromLocation.trim().toUpperCase();
  const toBinLocation = toStoreroom ? 'STOREROOM' : toLocation.trim().toUpperCase();
  const fromLocationResolved = fromStoreroom || fromLocation.trim().length > 0;
  const toLocationResolved = toStoreroom || toLocation.trim().length > 0;
  const transferSameLocation =
    fromLocationResolved && toLocationResolved && fromBinLocation === toBinLocation;
  const fromBin = useMemo(
    () => bins.find((b) => b.locationCode === fromBinLocation) ?? null,
    [bins, fromBinLocation]
  );
  const transferMaxQty = fromBin?.availableStock ?? 0;
  const parsedXferQty = parseInt(xferQty, 10);

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    setStockError(null);
    try {
      const [availabilityRes, binsRes] = await Promise.all([
        inventoryApi.getAvailability(storeId, product.sku),
        inventoryApi.getBins(storeId, product.sku)
      ]);
      setAvailability(availabilityRes.products?.[0] ?? null);
      setBins(binsRes);
    } catch (err) {
      setStockError(err instanceof InventoryApiError ? err.message : 'Could not load stock.');
      setAvailability(null);
      setBins([]);
    } finally {
      setLoadingStock(false);
    }
  }, [storeId, product.sku]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    if (tab !== 'adjust') return;
    setAdjustTarget(String(selectedCurrent));
  }, [tab, selectedBinLocation, selectedCurrent, bins]);

  useEffect(() => {
    if (fromStoreroom && toStoreroom) {
      setToStoreroom(false);
    }
  }, [fromStoreroom, toStoreroom]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseInt(addQty, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddError('Enter a positive quantity.');
      return;
    }
    if (!addStoreroom && !addLocation.trim()) {
      setAddError('Enter a shelf location or use storeroom.');
      return;
    }

    setAddBusy(true);
    setAddError(null);
    try {
      const res = await inventoryApi.addStock({
        sku: product.sku,
        storeId,
        quantity,
        reason: addReason.trim() || undefined,
        storeroom: addStoreroom,
        locationCode: addStoreroom ? undefined : addLocation.trim()
      });
      toast.push('success', res.idempotent ? 'Stock already added (duplicate request).' : `Added ${res.quantityAdded} units → ${res.newCurrentStock} total at ${res.locationCode}.`);
      setAddQty('');
      await loadStock();
      onStockChanged?.();
    } catch (err) {
      setAddError(err instanceof InventoryApiError ? err.message : 'Add stock failed.');
    } finally {
      setAddBusy(false);
    }
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseInt(xferQty, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setXferError('Enter a positive quantity.');
      return;
    }
    if (!fromStoreroom && !fromLocation.trim()) {
      setXferError('Specify a source location or use storeroom.');
      return;
    }
    if (!toStoreroom && !toLocation.trim()) {
      setXferError('Specify a destination location or use storeroom.');
      return;
    }
    if (transferSameLocation) {
      setXferError('From and to must be different bins — transfer moves stock between locations.');
      return;
    }
    if (!fromBin) {
      setXferError(`No stock at source bin ${fromBinLocation || '(select source)'}.`);
      return;
    }
    if (transferMaxQty <= 0) {
      setXferError(`Nothing transferable at ${fromBinLocation} (${fromBin.reservedStock} reserved, ${fromBin.currentStock} on hand).`);
      return;
    }
    if (quantity > transferMaxQty) {
      setXferError(`Cannot transfer more than ${transferMaxQty} unreserved units from ${fromBinLocation}.`);
      return;
    }

    setXferBusy(true);
    setXferError(null);
    try {
      const res = await inventoryApi.transferStock({
        sku: product.sku,
        storeId,
        quantity,
        reason: xferReason.trim() || undefined,
        fromStoreroom,
        fromLocationCode: fromStoreroom ? undefined : fromLocation.trim(),
        toStoreroom,
        toLocationCode: toStoreroom ? undefined : toLocation.trim()
      });
      toast.push(
        'success',
        res.idempotent
          ? 'Transfer already recorded.'
          : `Moved ${res.quantityTransferred} from ${res.fromLocationCode} → ${res.toLocationCode}.`
      );
      setXferQty('');
      await loadStock();
      onStockChanged?.();
    } catch (err) {
      setXferError(err instanceof InventoryApiError ? err.message : 'Transfer failed.');
    } finally {
      setXferBusy(false);
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustReason.trim()) {
      setAdjustError('Reason is required for corrections.');
      return;
    }
    if (!adjustStoreroom && !adjustLocation.trim()) {
      setAdjustError('Enter a shelf location or use storeroom.');
      return;
    }
    if (!targetValid) {
      setAdjustError('Enter a valid correct quantity (0 or more).');
      return;
    }
    if (parsedTarget < selectedReserved) {
      setAdjustError(`Cannot set below reserved stock (${selectedReserved} units held for orders).`);
      return;
    }

    setAdjustBusy(true);
    setAdjustError(null);
    try {
      const res = await inventoryApi.adjustStock({
        sku: product.sku,
        storeId,
        targetCurrentStock: parsedTarget,
        expectedCurrentStock: selectedCurrent,
        reason: adjustReason.trim(),
        storeroom: adjustStoreroom,
        locationCode: adjustStoreroom ? undefined : adjustLocation.trim()
      });
      if (res.noChange) {
        toast.push('info', 'No change — quantity already matches.');
      } else {
        toast.push(
          'success',
          res.idempotent
            ? 'Correction already recorded (duplicate request).'
            : `Updated ${res.locationCode}: ${res.previousCurrentStock} → ${res.newCurrentStock}.`
        );
      }
      await loadStock();
      onStockChanged?.();
    } catch (err) {
      const msg = err instanceof InventoryApiError ? err.message : 'Adjust stock failed.';
      setAdjustError(msg.includes('changed from') || msg.includes('STALE') ? `${msg} Click Refresh and try again.` : msg);
    } finally {
      setAdjustBusy(false);
    }
  }

  const highlightedBins = useMemo(() => {
    const codes = new Set<string>();
    if (tab === 'add') {
      codes.add(addStoreroom ? 'STOREROOM' : addLocation.trim().toUpperCase());
    } else if (tab === 'transfer') {
      codes.add(fromStoreroom ? 'STOREROOM' : fromLocation.trim().toUpperCase());
      codes.add(toStoreroom ? 'STOREROOM' : toLocation.trim().toUpperCase());
    } else if (tab === 'adjust') {
      codes.add(selectedBinLocation);
    }
    codes.delete('');
    return codes;
  }, [tab, addStoreroom, addLocation, fromStoreroom, fromLocation, toStoreroom, toLocation, selectedBinLocation]);

  const statusTone =
    availability?.availabilityStatus === 'OUT_OF_STOCK'
      ? 'red'
      : availability?.availabilityStatus === 'LOW_STOCK'
        ? 'amber'
        : availability?.availabilityStatus === 'AVAILABLE'
          ? 'green'
          : 'gray';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Stock at store {storeId}</h3>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={loadStock} disabled={loadingStock}>
          {loadingStock ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {stockError && <ErrorBox message={stockError} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Store available"
          value={loadingStock ? '…' : availability?.availableStock ?? 0}
          sub={availability?.availabilityStatus ? <Badge tone={statusTone}>{availability.availabilityStatus.replace('_', ' ')}</Badge> : 'No stock record yet'}
        />
        <Stat label="Store on hand" value={loadingStock ? '…' : availability?.currentStock ?? 0} sub="All bins combined" />
        <Stat label="Store reserved" value={loadingStock ? '…' : availability?.reservedStock ?? 0} sub="Held for orders" />
      </div>

      <BinStockTable bins={bins} loading={loadingStock} highlightLocations={highlightedBins} />

      <Card className="space-y-4">
        <div className="flex gap-1 border-b border-gray-100 pb-1">
          <OpTabButton active={tab === 'add'} onClick={() => setTab('add')} icon={PackagePlus} label="Add stock" />
          <OpTabButton active={tab === 'transfer'} onClick={() => setTab('transfer')} icon={ArrowRightLeft} label="Transfer" />
          <OpTabButton active={tab === 'adjust'} onClick={() => setTab('adjust')} icon={SlidersHorizontal} label="Adjust" />
        </div>

        {tab === 'add' && (
          <form onSubmit={submitAdd} className="space-y-4">
            {addError && <ErrorBox message={addError} />}
            <Field label="Quantity" hint="Units received into the store.">
              <input className="input w-32" type="number" min="1" value={addQty} onChange={(e) => setAddQty(e.target.value)} required />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={addStoreroom} onChange={(e) => setAddStoreroom(e.target.checked)} />
              Add to storeroom (default inbound bin)
            </label>
            {!addStoreroom && (
              <Field label="Shelf location" hint="Pick-face or aisle code, e.g. A1-S3.">
                <input className="input max-w-xs font-mono uppercase" value={addLocation} onChange={(e) => setAddLocation(e.target.value.toUpperCase())} placeholder="A1-S3" list="shelf-bin-options" />
              </Field>
            )}
            <Field label="Reason">
              <input className="input max-w-sm" value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder="INWARDING" />
            </Field>
            <button type="submit" className="btn-primary" disabled={addBusy}>
              {addBusy ? <Spinner className="h-4 w-4" /> : 'Add stock'}
            </button>
          </form>
        )}

        {tab === 'transfer' && (
          <form onSubmit={submitTransfer} className="space-y-4">
            {xferError && <ErrorBox message={xferError} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <LocationEndpoint
                title="From"
                storeroom={fromStoreroom}
                onStoreroomChange={setFromStoreroom}
                location={fromLocation}
                onLocationChange={setFromLocation}
              />
              <LocationEndpoint
                title="To"
                storeroom={toStoreroom}
                onStoreroomChange={setToStoreroom}
                location={toLocation}
                onLocationChange={setToLocation}
                disableStoreroom={fromStoreroom}
                disableStoreroomHint="Cannot transfer storeroom → storeroom."
              />
            </div>
            {transferSameLocation && (
              <p className="text-sm text-red-600">
                From and to are the same bin ({fromBinLocation}). Pick a different destination.
              </p>
            )}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-mono text-xs uppercase tracking-wide text-gray-400">Source: {fromBinLocation || '—'}</p>
              {fromBin ? (
                <p className="mt-1 text-gray-700">
                  <span className="font-semibold text-gray-900">{transferMaxQty}</span> transferable
                  <span className="text-gray-500"> ({fromBin.currentStock} on hand, {fromBin.reservedStock} reserved)</span>
                </p>
              ) : (
                <p className="mt-1 text-amber-700">No stock record at this source bin.</p>
              )}
            </div>
            <Field
              label="Quantity"
              hint={transferMaxQty > 0 ? `Max ${transferMaxQty} unreserved units from ${fromBinLocation}.` : 'Select a source bin with available stock.'}
            >
              <input
                className="input w-32"
                type="number"
                min="1"
                max={transferMaxQty > 0 ? transferMaxQty : undefined}
                value={xferQty}
                onChange={(e) => setXferQty(e.target.value)}
                required
                disabled={transferMaxQty <= 0}
              />
            </Field>
            {Number.isFinite(parsedXferQty) && parsedXferQty > transferMaxQty && transferMaxQty > 0 && (
              <p className="text-sm text-red-600">Quantity exceeds available unreserved stock at source ({transferMaxQty}).</p>
            )}
            <Field label="Reason">
              <input className="input max-w-sm" value={xferReason} onChange={(e) => setXferReason(e.target.value)} placeholder="REPLENISH_SHELF" />
            </Field>
            <button type="submit" className="btn-primary" disabled={xferBusy || transferMaxQty <= 0 || transferSameLocation}>
              {xferBusy ? <Spinner className="h-4 w-4" /> : 'Transfer stock'}
            </button>
          </form>
        )}

        {tab === 'adjust' && (
          <form onSubmit={submitAdjust} className="space-y-4">
            {adjustError && <ErrorBox message={adjustError} />}
            <p className="text-sm font-medium text-gray-900">Correct quantity at bin</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={adjustStoreroom} onChange={(e) => setAdjustStoreroom(e.target.checked)} />
              Storeroom bin
            </label>
            {!adjustStoreroom && (
              <Field label="Shelf location" hint="Pick-face or aisle code, e.g. A1-S3.">
                <input
                  className="input max-w-xs font-mono uppercase"
                  value={adjustLocation}
                  onChange={(e) => setAdjustLocation(e.target.value.toUpperCase())}
                  placeholder="A1-S3"
                  list="shelf-bin-options"
                />
              </Field>
            )}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-mono text-xs uppercase tracking-wide text-gray-400">{selectedBinLocation || 'Select bin'}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-500">On hand</p>
                  <p className="text-lg font-semibold text-gray-900">{loadingStock ? '…' : selectedCurrent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Reserved</p>
                  <p className="text-lg font-semibold text-amber-700">{loadingStock ? '…' : selectedReserved}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Minimum allowed</p>
                  <p className="text-lg font-semibold text-gray-700">{loadingStock ? '…' : selectedReserved}</p>
                </div>
              </div>
            </div>
            <Field label="Correct quantity" hint="Enter what the count should be at this bin (not the difference).">
              <input
                className="input w-32"
                type="number"
                min={selectedReserved}
                value={adjustTarget}
                onChange={(e) => setAdjustTarget(e.target.value)}
                required
              />
            </Field>
            {targetValid && adjustDelta !== null && adjustDelta !== 0 && (
              <p className={clsx('text-sm font-medium', adjustDelta < 0 ? 'text-red-600' : 'text-green-700')}>
                Will {adjustDelta < 0 ? 'remove' : 'add'} {Math.abs(adjustDelta)} unit{Math.abs(adjustDelta) === 1 ? '' : 's'} ({selectedCurrent} → {parsedTarget})
              </p>
            )}
            {targetValid && adjustDelta === 0 && (
              <p className="text-sm text-gray-500">No change — already at {selectedCurrent}.</p>
            )}
            <Field label="Reason" hint="Required — appears in the stock movement audit trail.">
              <input className="input max-w-sm" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="CORRECTION_OVER_INWARD" required />
            </Field>
            <button type="submit" className="btn-primary" disabled={adjustBusy || loadingStock}>
              {adjustBusy ? <Spinner className="h-4 w-4" /> : 'Update quantity'}
            </button>
          </form>
        )}
      </Card>

      <datalist id="shelf-bin-options">
        {bins
          .filter((b) => b.locationCode !== 'STOREROOM')
          .map((b) => (
            <option key={b.locationCode} value={b.locationCode} />
          ))}
      </datalist>
    </div>
  );
}

function BinStockTable({
  bins,
  loading,
  highlightLocations
}: {
  bins: InventoryBinResponse[];
  loading: boolean;
  highlightLocations: Set<string>;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
        Loading bin breakdown…
      </div>
    );
  }

  if (bins.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
        No stock bins yet for this SKU at this store.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stock by bin</p>
        <p className="text-xs text-gray-400">Add, transfer, and adjust operate on one bin at a time.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">On hand</th>
              <th className="px-4 py-2 font-medium">Reserved</th>
              <th className="px-4 py-2 font-medium">Available</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((bin) => {
              const highlighted = highlightLocations.has(bin.locationCode);
              return (
                <tr
                  key={bin.locationCode}
                  className={clsx(
                    'border-b border-gray-50 last:border-0',
                    highlighted && 'bg-brand-green-light/40'
                  )}
                >
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{bin.locationCode}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{bin.currentStock}</td>
                  <td className="px-4 py-2 text-amber-700">{bin.reservedStock}</td>
                  <td className="px-4 py-2 text-gray-700">{bin.availableStock}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpTabButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition',
        active ? 'bg-brand-green-light text-brand-green-dark' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function LocationEndpoint({
  title,
  storeroom,
  onStoreroomChange,
  location,
  onLocationChange,
  disableStoreroom = false,
  disableStoreroomHint
}: {
  title: string;
  storeroom: boolean;
  onStoreroomChange: (v: boolean) => void;
  location: string;
  onLocationChange: (v: string) => void;
  disableStoreroom?: boolean;
  disableStoreroomHint?: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <label className={clsx('flex items-center gap-2 text-sm', disableStoreroom ? 'text-gray-400' : 'text-gray-700')}>
        <input
          type="checkbox"
          checked={storeroom}
          onChange={(e) => onStoreroomChange(e.target.checked)}
          disabled={disableStoreroom}
        />
        Storeroom
      </label>
      {disableStoreroom && disableStoreroomHint && (
        <p className="text-xs text-gray-500">{disableStoreroomHint}</p>
      )}
      {!storeroom && (
        <input
          className="input font-mono uppercase"
          value={location}
          onChange={(e) => onLocationChange(e.target.value.toUpperCase())}
          placeholder="Shelf code"
          list="shelf-bin-options"
        />
      )}
    </div>
  );
}
