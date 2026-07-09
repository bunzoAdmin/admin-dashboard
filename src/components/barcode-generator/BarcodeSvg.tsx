'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeSvgProps {
  value: string;
  format: string;
  height?: number;
}

export const BarcodeSvg = forwardRef<SVGSVGElement, BarcodeSvgProps>(function BarcodeSvg(
  { value, format, height = 60 },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => svgRef.current!, []);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: format === 'EAN13' ? 'EAN13' : 'CODE128',
        width: 1.8,
        height,
        fontSize: 11,
        margin: 4,
        displayValue: true
      });
    } catch {
      if (svgRef.current) svgRef.current.innerHTML = '';
    }
  }, [value, format, height]);

  return <svg ref={svgRef} className="max-w-full" />;
});
