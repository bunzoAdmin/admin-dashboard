'use client';

type Props = {
  storeId?: number | null;
  message?: string | null;
  enabledStoreIds?: number[];
  className?: string;
};

export function ZraNotEnabledNotice({ storeId, message, enabledStoreIds, className = '' }: Props) {
  const enabled =
    enabledStoreIds && enabledStoreIds.length > 0
      ? enabledStoreIds.join(', ')
      : null;

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`.trim()}>
      <p className="font-medium">
        {message?.trim() ||
          (storeId != null
            ? `ZRA is not enabled for store ${storeId}.`
            : 'ZRA is not enabled for this store.')}
      </p>
      {enabled && (
        <p className="mt-1 text-xs text-amber-800">
          Configured ZRA store(s): <span className="font-mono">{enabled}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-amber-700">
        Device credentials are store-specific. Add this store to{' '}
        <span className="font-mono">ZRA_ENABLED_STORE_IDS</span> (and{' '}
        <span className="font-mono">ZRA_STORES_&lt;id&gt;_*</span> when you have a second device).
      </p>
    </div>
  );
}

export function isZraNotEnabledMessage(message?: string | null): boolean {
  if (!message) return false;
  return /ZRA is not enabled for store/i.test(message);
}
