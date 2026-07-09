'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { Darkstore } from '@/lib/types';
import { clearStoreId, readStoreId, writeStoreId } from '@/lib/storeSession';
import { Field } from '@/components/ui';

const PINNED_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID
    ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_STORE_ID, 10)
    : null;

interface StoreSelectorProps {
  storeId: number | null;
  onStoreChange: (storeId: number | null) => void;
  className?: string;
}

function parseStoreId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function StoreSelector({ storeId, onStoreChange, className }: StoreSelectorProps) {
  const [stores, setStores] = useState<Darkstore[]>([]);
  const [input, setInput] = useState(storeId != null ? String(storeId) : '');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (PINNED_STORE_ID) return;

    api.listDarkstores()
      .then((res) => setStores(res.darkstores))
      .catch((err) => setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load stores.'));
  }, []);

  useEffect(() => {
    setInput(storeId != null ? String(storeId) : '');
  }, [storeId]);

  // If sessionStorage holds a stale ID (e.g. "1" from an old default) that is not
  // in the live store list, the <select> can visually show the first option while
  // React state and API calls still use the invalid ID. Clear it so the user must
  // pick explicitly.
  useEffect(() => {
    if (stores.length === 0 || storeId == null) return;
    const validIds = new Set(
      stores.map((s) => parseStoreId(s.darkstore_id)).filter((id): id is number => id != null)
    );
    if (!validIds.has(storeId)) onStoreChange(null);
  }, [stores, storeId, onStoreChange]);

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
      if (!value) return;
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
        <select
          className="input max-w-xs"
          value={storeId != null ? String(storeId) : ''}
          onChange={(e) => onSelectChange(e.target.value)}
        >
          <option value="" disabled>— Select a store —</option>
          {stores.map((s) => (
            <option key={s.darkstore_id} value={s.darkstore_id}>
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
          placeholder="Store ID"
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
  const [storeId, setStoreId] = useState<number | null>(PINNED_STORE_ID);

  useEffect(() => {
    if (!PINNED_STORE_ID) setStoreId(readStoreId());
  }, []);

  const changeStore = useCallback((id: number | null) => {
    if (id == null) {
      clearStoreId();
      setStoreId(null);
    } else {
      writeStoreId(id);
      setStoreId(id);
    }
  }, []);

  return { storeId, setStoreId: changeStore };
}
