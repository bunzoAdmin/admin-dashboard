'use client';

import type { QrDailyBucket } from '@/lib/qrTypes';

export function ScanBars({ data }: { data: QrDailyBucket[] }) {
  if (!data.length) return <div className="text-sm text-gray-400">No scans in this range.</div>;
  const max = Math.max(1, ...data.map((d) => d.scans));
  return (
    <div className="flex h-40 items-end gap-1 overflow-x-auto">
      {data.map((d) => (
        <div key={d.date} className="flex min-w-[10px] flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.scans}`}>
          <div className="text-[9px] text-gray-500">{d.scans || ''}</div>
          <div
            className="w-full rounded-t bg-brand-green"
            style={{ height: `${Math.round((d.scans / max) * 120)}px`, minHeight: d.scans ? '2px' : '0px' }}
          />
          <div className="text-[8px] text-gray-400">{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}
