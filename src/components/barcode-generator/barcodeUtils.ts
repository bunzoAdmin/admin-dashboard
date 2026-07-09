import type { CategoryTreeNode } from '@/lib/catalogTypes';

export function downloadBarcodePng(svgEl: SVGSVGElement, filename: string): void {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const bbox = svgEl.getBoundingClientRect();
  const w = Math.round(bbox.width) || 220;
  const h = Math.round(bbox.height) || 110;
  const scale = 3; // 3× resolution for crisp print quality
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = url;
}

export function printBarcode(svgEl: SVGSVGElement, label: string): void {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);

  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html><head>
    <title>${label}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { display: flex; flex-direction: column; align-items: center; justify-content: center;
             padding: 16px; font-family: sans-serif; background: #fff; }
      svg { max-width: 280px; }
      p { font-size: 11px; color: #444; margin-top: 6px; text-align: center; }
    </style>
  </head><body>${svgStr}<p>${label}</p></body></html>`);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 2000);
}

export function flattenCategories(
  nodes: CategoryTreeNode[],
  depth = 0
): { id: number; name: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: '\u00a0\u00a0'.repeat(depth) + n.name },
    ...flattenCategories(n.children ?? [], depth + 1)
  ]);
}

export function formatBarcodeDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
