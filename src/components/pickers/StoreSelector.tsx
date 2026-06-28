'use client';

import { useCallback, useEffect, useState } from 'react';
import { listStores, StoresApiError } from '@/lib/storesApi';
import type { StoreResponse } from '@/lib/pickerTypes';
import { defaultStoreId, readStoreId, writeStoreId } from '@/lib/storeSession';
import { Field } from '@/components/ui';

interface StoreSelectorProps {
  storeId: number;
  onStoreChange: (storeId: number) => void;
  className?: string;
}

export function StoreSelector({ storeId, onStoreChange, className }: StoreSelectorProps) {
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [input, setInput] = useState(String(storeId));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listStores()
      .then(setStores)
      .catch((err) => setLoadError(err instanceof StoresApiError ? err.message : 'Failed to load stores.'));
  }, []);

  useEffect(() => {
    setInput(String(storeId));
  }, [storeId]);

  function applyManual() {
    const id = parseInt(input, 10);
    if (!Number.isFinite(id) || id <= 0) return;
    writeStoreId(id);
    onStoreChange(id);
  }

  const onSelectChange = useCallback(
    (value: string) => {
      const id = parseInt(value, 10);
      if (!Number.isFinite(id)) return;
      setInput(String(id));
      writeStoreId(id);
      onStoreChange(id);
    },
    [onStoreChange]
  );

  if (stores.length > 0) {
    return (
      <Field label="Store" className={className}>
        <select className="input max-w-xs" value={String(storeId)} onChange={(e) => onSelectChange(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.storeCode ? `(${s.storeCode})` : ''} — #{s.id}
            </option>
          ))}
        </select>
        {loadError && <p className="text-xs text-amber-600">{loadError}</p>}
      </Field>
    );
  }

  return (
    <Field label="Store ID" hint={loadError ?? 'Enter store ID if stores list unavailable.'} className={className}>
      <div className="flex gap-2">
        <input
          className="input w-28"
          type="number"
          min="1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyManual()}
        />
        <button type="button" className="btn-ghost shrink-0" onClick={applyManual}>
          Apply
        </button>
      </div>
    </Field>
  );
}

export function useStoreContext() {
  const [storeId, setStoreId] = useState(defaultStoreId());

  useEffect(() => {
    setStoreId(readStoreId());
  }, []);

  const changeStore = useCallback((id: number) => {
    writeStoreId(id);
    setStoreId(id);
  }, []);

  return { storeId, setStoreId: changeStore };
}
