'use client';

import { ZraBulkRegisterPanel } from '@/components/orders/ZraBulkRegisterPanel';

export default function ZraItemsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ZRA Items</h1>
        <p className="text-sm text-gray-500">
          Register catalog SKUs with VSDC via saveItem (bulk). Lazy registration still runs on delivery.
        </p>
      </div>
      <ZraBulkRegisterPanel />
    </div>
  );
}
