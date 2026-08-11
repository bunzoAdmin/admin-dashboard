'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { Field } from '@/components/ui';
import { api } from '@/lib/api';
import { zraApi, type ZraBranchInfo } from '@/lib/zraApi';

export const ZRA_ALL_STORES_SCOPE = 'ALL';

const ZRA_STORE_KEY = 'bunzo_zra_store_id';

function readZraStoreId(): number | null {
  if (typeof window === 'undefined') return null;
  const n = parseInt(sessionStorage.getItem(ZRA_STORE_KEY) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function writeZraStoreId(id: number | null) {
  if (typeof window === 'undefined') return;
  if (id == null) sessionStorage.removeItem(ZRA_STORE_KEY);
  else sessionStorage.setItem(ZRA_STORE_KEY, String(id));
}

export type ZraStoreOption = {
  storeId: number;
  label: string;
  bhfId?: string;
};

type ZraStoreContextValue = {
  storeId: number | null;
  setStoreId: (id: number | null) => void;
  storeIdParam: number | undefined;
  validStore: boolean;
  storeIdLabel: string;
  enabledStores: ZraStoreOption[];
  loading: boolean;
  error: string | null;
};

const ZraStoreContext = createContext<ZraStoreContextValue | null>(null);

export function ZraStoreProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreIdState] = useState<number | null>(null);
  const [enabledStores, setEnabledStores] = useState<ZraStoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setStoreId = useCallback((id: number | null) => {
    writeZraStoreId(id);
    setStoreIdState(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      zraApi.listBranches(),
      api.listDarkstores().catch(() => ({ darkstores: [] as { darkstore_id: string; name: string }[] }))
    ])
      .then(([branches, dark]) => {
        if (cancelled) return;
        const nameById = new Map(
          (dark.darkstores ?? []).map((s) => [parseInt(s.darkstore_id, 10), s.name] as const)
        );
        const opts: ZraStoreOption[] = [];
        for (const b of branches ?? []) {
          const id = b.storeId;
          if (id == null || !Number.isFinite(id) || id <= 0) continue;
          const name = nameById.get(id);
          opts.push({
            storeId: id,
            label: name
              ? `${name} — #${id}${b.bhfId ? ` · bhf ${b.bhfId}` : ''}`
              : `Store #${id}${b.bhfId ? ` · bhf ${b.bhfId}` : ''}`,
            bhfId: b.bhfId
          });
        }
        opts.sort((a, b) => a.storeId - b.storeId);

        setEnabledStores(opts);
        setError(opts.length === 0 ? 'No ZRA-enabled stores configured on order-service.' : null);

        const saved = readZraStoreId();
        const validSaved = saved != null && opts.some((o) => o.storeId === saved);
        if (validSaved) {
          setStoreIdState(saved);
        } else if (opts.length >= 1) {
          // Default to first (or only) ZRA-enabled store — never a non-ZRA darkstore.
          writeZraStoreId(opts[0].storeId);
          setStoreIdState(opts[0].storeId);
        } else {
          writeZraStoreId(null);
          setStoreIdState(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load ZRA stores.');
        setEnabledStores([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ZraStoreContextValue>(
    () => ({
      storeId,
      setStoreId,
      storeIdParam: storeId ?? undefined,
      validStore: storeId != null && storeId > 0,
      storeIdLabel: storeId != null ? String(storeId) : '—',
      enabledStores,
      loading,
      error
    }),
    [storeId, setStoreId, enabledStores, loading, error]
  );

  return <ZraStoreContext.Provider value={value}>{children}</ZraStoreContext.Provider>;
}

export function useZraStore(): ZraStoreContextValue {
  const ctx = useContext(ZraStoreContext);
  if (!ctx) {
    throw new Error('useZraStore must be used within ZraStoreProvider (zra layout).');
  }
  return ctx;
}

type ZraStoreSelectorProps = {
  className?: string;
  /** When true, adds an "All stores" option (audit / VAT filters). */
  allowAll?: boolean;
  scope?: string | null;
  onScopeChange?: (scope: string | null) => void;
};

export function ZraStoreSelector({
  className,
  allowAll = false,
  scope = null,
  onScopeChange
}: ZraStoreSelectorProps) {
  const { storeId, setStoreId, enabledStores, loading, error } = useZraStore();

  const value = scope ?? (storeId != null ? String(storeId) : '');

  return (
    <Field label="ZRA store" className={className} hint={error ?? undefined}>
      <select
        className="input max-w-xs"
        disabled={loading || (enabledStores.length === 0 && !allowAll)}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (allowAll && v === ZRA_ALL_STORES_SCOPE) {
            onScopeChange?.(ZRA_ALL_STORES_SCOPE);
            return;
          }
          const id = parseInt(v, 10);
          if (!Number.isFinite(id)) return;
          onScopeChange?.(null);
          setStoreId(id);
        }}
      >
        <option value="" disabled>
          {loading ? 'Loading stores…' : '— Select a ZRA store —'}
        </option>
        {allowAll && <option value={ZRA_ALL_STORES_SCOPE}>All ZRA stores</option>}
        {enabledStores.map((s) => (
          <option key={s.storeId} value={String(s.storeId)}>
            {s.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
