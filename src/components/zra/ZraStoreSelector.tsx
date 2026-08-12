'use client';

import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

export const ZRA_ALL_STORES_SCOPE = 'ALL';

/** Same store selection as Orders/Inventory (all darkstores). */
export function useZraStore() {
  const { storeId, setStoreId } = useStoreContext();
  return {
    storeId,
    setStoreId,
    storeIdParam: storeId ?? undefined,
    validStore: storeId != null && storeId > 0,
    storeIdLabel: storeId != null ? String(storeId) : '—'
  };
}

type ZraStoreSelectorProps = {
  /**
   * Current store id and setter — pass the values from the SAME `useZraStore()`
   * call the page uses for its own data fetching. `useStoreContext()` holds
   * plain `useState`, not a shared React context, so calling it again inside
   * this component (as this used to do) creates a second, unsynced copy of
   * the selection: picking a store here would update this component's local
   * state and sessionStorage, but the page's own `storeId` would stay stale
   * until a full reload. Making this a controlled component (like the plain
   * `StoreSelector` used on Orders/Inventory pages) fixes that.
   */
  storeId: number | null;
  onStoreChange: (storeId: number | null) => void;
  className?: string;
  /** When true, adds an "All stores" option (audit / VAT filters). */
  allowAll?: boolean;
  scope?: string | null;
  onScopeChange?: (scope: string | null) => void;
};

export function ZraStoreSelector({
  storeId,
  onStoreChange,
  className,
  allowAll = false,
  scope = null,
  onScopeChange
}: ZraStoreSelectorProps) {
  return (
    <StoreSelector
      storeId={storeId}
      onStoreChange={onStoreChange}
      className={className}
      extraScopes={allowAll ? [{ value: ZRA_ALL_STORES_SCOPE, label: 'All stores' }] : []}
      scope={scope}
      onScopeChange={onScopeChange}
    />
  );
}
