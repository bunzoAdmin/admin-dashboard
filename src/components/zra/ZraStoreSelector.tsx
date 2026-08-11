'use client';

import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';

export const ZRA_ALL_STORES_SCOPE = 'ALL';

const ALL_STORES_OPTION = { value: ZRA_ALL_STORES_SCOPE, label: 'All stores' };

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
  /** When true, adds an "All stores" option (audit / VAT report filters). */
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
      extraScopes={allowAll ? [ALL_STORES_OPTION] : []}
      scope={scope}
      onScopeChange={onScopeChange}
    />
  );
}
