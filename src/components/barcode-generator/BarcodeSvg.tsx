'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function BarcodeSvg({
  value,
  format,
  height = 60
}: {
  value: string;
  format: string;
  height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: format === 'EAN13' ? 'EAN13' : 'CODE128',
        width: 1.8,
        height,
        fontSize: 11,
        margin: 4,
        displayValue: true
      });
    } catch {
      if (ref.current) ref.current.innerHTML = '';
    }
  }, [value, format, height]);

  return <svg ref={ref} className="max-w-full" />;
}
