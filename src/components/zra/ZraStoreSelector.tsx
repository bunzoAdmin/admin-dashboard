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
  const { storeId, setStoreId } = useStoreContext();

  return (
    <StoreSelector
      storeId={storeId}
      onStoreChange={setStoreId}
      className={className}
      extraScopes={allowAll ? [{ value: ZRA_ALL_STORES_SCOPE, label: 'All stores' }] : []}
      scope={scope}
      onScopeChange={onScopeChange}
    />
  );
}
