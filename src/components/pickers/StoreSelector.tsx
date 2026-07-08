'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { Darkstore } from '@/lib/types';
import { defaultStoreId, readStoreId, writeStoreId } from '@/lib/storeSession';
import { Field } from '@/components/ui';

const PINNED_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID
  ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_STORE_ID, 10)
  : null;

interface StoreSelectorProps {
  storeId: number;
  onStoreChange: (storeId: number) => void;
  className?: string;
}

export function StoreSelector({ storeId, onStoreChange, className }: StoreSelectorProps) {
  const [stores, setStores] = useState<Darkstore[]>([]);
  const [input, setInput] = useState(String(storeId));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // When a default store is pinned via env var (local dev), skip the API call.
    if (PINNED_STORE_ID) return;

    api.listDarkstores()
      .then((res) => setStores(res.darkstores))
      .catch((err) => setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load stores.'));
  }, []);

  useEffect(() => {
    setInput(String(storeId));
  }, [storeId]);

  // Local dev: show a static badge — no API call, no dropdown.
  if (PINNED_STORE_ID) {
    return (
      <Field label="Store" hint="Pinned by NEXT_PUBLIC_DEFAULT_STORE_ID (local dev)." className={className}>
        <div className="flex items-center gap-2">
          <span className="input w-28 cursor-default select-none bg-gray-50 text-gray-500">
            #{PINNED_STORE_ID}
          </span>
        </div>
      </Field>
    );
  }

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
            <option key={s.darkstore_id} value={parseInt(s.darkstore_id, 10)}>
              {s.name} — #{s.darkstore_id}
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
  const [storeId, setStoreId] = useState(PINNED_STORE_ID ?? defaultStoreId());

  useEffect(() => {
    // When a store is pinned via env var, ignore whatever is in sessionStorage.
    if (!PINNED_STORE_ID) setStoreId(readStoreId());
  }, []);

  const changeStore = useCallback((id: number) => {
    writeStoreId(id);
    setStoreId(id);
  }, []);

  return { storeId, setStoreId: changeStore };
}
