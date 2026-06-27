'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { StoreQRDisplay } from '@/components/StoreQRDisplay';
import { Card, Field, Loading } from '@/components/ui';

function StoreQRPageContent() {
  const params = useSearchParams();
  const initialStore = params.get('store')?.trim() ?? '';
  const [storeId, setStoreId] = useState(initialStore);
  const [activeStore, setActiveStore] = useState(initialStore);

  function loadStore(e?: React.FormEvent) {
    e?.preventDefault();
    const id = storeId.trim();
    if (!id) return;
    setActiveStore(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Store QR</h1>
        <p className="text-sm text-gray-500">
          Display the hourly duty QR for a darkstore. Drivers scan it to go on duty — the code refreshes automatically each hour.
        </p>
      </div>

      <Card className="max-w-xl">
        <form onSubmit={loadStore} className="flex flex-wrap items-end gap-3">
          <Field label="Store ID" hint="3-digit store code, e.g. 221." className="min-w-[12rem] flex-1">
            <input
              className="input font-mono"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="221"
              inputMode="numeric"
              maxLength={3}
            />
          </Field>
          <button type="submit" className="btn-primary shrink-0" disabled={storeId.trim().length < 3}>
            <QrCode className="h-4 w-4" />
            Show QR
          </button>
        </form>
      </Card>

      {activeStore.length >= 3 ? (
        <StoreQRDisplay storeId={activeStore} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-400">
          Enter a store ID above to generate the QR code.
        </div>
      )}
    </div>
  );
}

export default function StoreQRPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <StoreQRPageContent />
    </Suspense>
  );
}
