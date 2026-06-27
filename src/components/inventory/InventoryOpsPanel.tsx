'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, PackagePlus, RefreshCw } from 'lucide-react';
import { inventoryApi, InventoryApiError } from '@/lib/inventoryApi';
import type { ProductAvailability } from '@/lib/inventoryTypes';
import type { ProductResponse } from '@/lib/catalogTypes';
import { Badge, Card, ErrorBox, Field, Spinner, Stat, useToast } from '@/components/ui';

type OpTab = 'add' | 'transfer';

interface InventoryOpsPanelProps {
  product: ProductResponse;
  storeId: number;
  onStockChanged?: () => void;
}

export function InventoryOpsPanel({ product, storeId, onStockChanged }: InventoryOpsPanelProps) {
  const toast = useToast();
  const [tab, setTab] = useState<OpTab>('add');
  const [availability, setAvailability] = useState<ProductAvailability | null>(null);
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

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    setStockError(null);
    try {
      const res = await inventoryApi.getAvailability(storeId, product.sku);
      setAvailability(res.products?.[0] ?? null);
    } catch (err) {
      setStockError(err instanceof InventoryApiError ? err.message : 'Could not load stock.');
      setAvailability(null);
    } finally {
      setLoadingStock(false);
    }
  }, [storeId, product.sku]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

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
          label="Available"
          value={loadingStock ? '…' : availability?.availableStock ?? 0}
          sub={availability?.availabilityStatus ? <Badge tone={statusTone}>{availability.availabilityStatus.replace('_', ' ')}</Badge> : 'No stock record yet'}
        />
        <Stat label="On hand" value={loadingStock ? '…' : availability?.currentStock ?? 0} sub="Current stock" />
        <Stat label="Reserved" value={loadingStock ? '…' : availability?.reservedStock ?? 0} sub="Held for orders" />
      </div>

      <Card className="space-y-4">
        <div className="flex gap-1 border-b border-gray-100 pb-1">
          <OpTabButton active={tab === 'add'} onClick={() => setTab('add')} icon={PackagePlus} label="Add stock" />
          <OpTabButton active={tab === 'transfer'} onClick={() => setTab('transfer')} icon={ArrowRightLeft} label="Transfer" />
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
                <input className="input max-w-xs font-mono uppercase" value={addLocation} onChange={(e) => setAddLocation(e.target.value.toUpperCase())} placeholder="A1-S3" />
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
            <Field label="Quantity">
              <input className="input w-32" type="number" min="1" value={xferQty} onChange={(e) => setXferQty(e.target.value)} required />
            </Field>
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
              />
            </div>
            <Field label="Reason">
              <input className="input max-w-sm" value={xferReason} onChange={(e) => setXferReason(e.target.value)} placeholder="REPLENISH_SHELF" />
            </Field>
            <button type="submit" className="btn-primary" disabled={xferBusy}>
              {xferBusy ? <Spinner className="h-4 w-4" /> : 'Transfer stock'}
            </button>
          </form>
        )}
      </Card>
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
  onLocationChange
}: {
  title: string;
  storeroom: boolean;
  onStoreroomChange: (v: boolean) => void;
  location: string;
  onLocationChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={storeroom} onChange={(e) => onStoreroomChange(e.target.checked)} />
        Storeroom
      </label>
      {!storeroom && (
        <input
          className="input font-mono uppercase"
          value={location}
          onChange={(e) => onLocationChange(e.target.value.toUpperCase())}
          placeholder="Shelf code"
        />
      )}
    </div>
  );
}
