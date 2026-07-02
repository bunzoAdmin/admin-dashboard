'use client';

import type { BarcodeEntryResponse } from '@/lib/catalogTypes';
import { BarcodeSvg } from './BarcodeSvg';

export function BarcodeCard({ entry }: { entry: BarcodeEntryResponse }) {
  return (
    <div className="card p-4 space-y-2 print:break-inside-avoid">
      <p className="text-sm font-semibold text-gray-800">{entry.productName}</p>
      <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-white p-2">
        <BarcodeSvg value={entry.barcode} format={entry.format} height={65} />
      </div>
      <p className="text-center text-xs font-mono text-gray-400">{entry.barcode}</p>
    </div>
  );
}
