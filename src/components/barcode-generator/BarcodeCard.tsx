'use client';

import { useRef } from 'react';
import { Download, Printer } from 'lucide-react';
import type { BarcodeEntryResponse } from '@/lib/catalogTypes';
import { BarcodeSvg } from './BarcodeSvg';
import { downloadBarcodePng, printBarcode } from './barcodeUtils';

export function BarcodeCard({ entry }: { entry: BarcodeEntryResponse }) {
  const svgRef = useRef<SVGSVGElement>(null);

  function handleDownload() {
    if (svgRef.current) downloadBarcodePng(svgRef.current, entry.productName);
  }

  function handlePrint() {
    if (svgRef.current) printBarcode(svgRef.current, entry.productName);
  }

  return (
    <div className="card p-4 space-y-2 print:break-inside-avoid">
      <p className="text-sm font-semibold text-gray-800">{entry.productName}</p>
      <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-white p-2">
        <BarcodeSvg ref={svgRef} value={entry.barcode} format={entry.format} height={65} />
      </div>
      <p className="text-center text-xs font-mono text-gray-400">{entry.barcode}</p>
      <div className="flex gap-2 print:hidden">
        <button
          type="button"
          className="btn-ghost flex flex-1 items-center justify-center gap-1 text-xs"
          onClick={handleDownload}
          title="Download as PNG"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <button
          type="button"
          className="btn-ghost flex flex-1 items-center justify-center gap-1 text-xs"
          onClick={handlePrint}
          title="Print this label"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
    </div>
  );
}
