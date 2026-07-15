'use client';

import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { Download, Printer } from 'lucide-react';
import type { QrPlacement } from '@/lib/qrTypes';
import { svgElementToPngBlob, downloadBlob, sanitizeFilename } from '@/lib/qrImage';

export function QrCard({ placement }: { placement: QrPlacement }) {
  const ref = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const blob = await svgElementToPngBlob(svg as SVGSVGElement, 1024);
    downloadBlob(blob, `${sanitizeFilename(placement.name)}_${placement.slug}.png`);
  }

  return (
    <div className="card flex flex-col items-center gap-3 p-4 print:break-inside-avoid">
      <div ref={ref} className="rounded-lg bg-white p-2">
        <QRCode value={placement.url} size={180} level="M" />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-900">{placement.name}</div>
        {placement.location && <div className="text-xs text-gray-500">{placement.location}</div>}
        <div className="mt-1 break-all text-[10px] text-gray-400">{placement.url}</div>
      </div>
      <div className="flex gap-2 print:hidden">
        <button type="button" onClick={handleDownload} className="btn-ghost flex items-center gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> PNG
        </button>
        <button type="button" onClick={() => window.print()} className="btn-ghost flex items-center gap-1.5 text-xs">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
    </div>
  );
}
