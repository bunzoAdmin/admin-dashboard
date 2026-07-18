import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import type { BarcodeDisplayEntry } from './barcodeUtils';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 10;
/** Larger shelf stickers for reliable handheld scan (~95 × 53 mm). */
const COLS = 2;
const ROWS = 5;
const GAP_MM = 4;
const LABEL_FONT_PT = 11;

interface BarcodePng {
  dataUrl: string;
  /** Intrinsic pixel size used to preserve aspect ratio in the PDF. */
  widthPx: number;
  heightPx: number;
}

function svgToPng(svg: SVGSVGElement, scale = 4): Promise<BarcodePng> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const width = Number(svg.getAttribute('width')) || 220;
    const height = Number(svg.getAttribute('height')) || 110;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas unavailable'));
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        widthPx: canvas.width,
        heightPx: canvas.height
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to rasterize barcode: ${svg.getAttribute('data-value') ?? ''}`));
    };
    img.src = url;
  });
}

function renderBarcodeSvg(value: string, format: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('data-value', value);
  JsBarcode(svg, value, {
    format: format === 'EAN13' ? 'EAN13' : 'CODE128',
    width: 2.2,
    height: 70,
    fontSize: 14,
    margin: 8,
    displayValue: true,
    background: '#ffffff'
  });
  return svg;
}

async function entryToPng(entry: BarcodeDisplayEntry): Promise<BarcodePng> {
  const svg = renderBarcodeSvg(entry.barcode, entry.format);
  return svgToPng(svg);
}

/** Fit image inside a box without stretching (letterbox). */
function fitInside(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return { width: srcW * scale, height: srcH * scale };
}

export async function downloadBarcodesPdf(
  entries: BarcodeDisplayEntry[],
  filename = 'rack-barcodes.pdf'
): Promise<void> {
  if (entries.length === 0) {
    throw new Error('No barcodes to export.');
  }

  const usableWidth = PAGE_WIDTH_MM - MARGIN_MM * 2;
  const usableHeight = PAGE_HEIGHT_MM - MARGIN_MM * 2;
  const cellWidth = (usableWidth - GAP_MM * (COLS - 1)) / COLS;
  const cellHeight = (usableHeight - GAP_MM * (ROWS - 1)) / ROWS;
  const perPage = COLS * ROWS;

  const pngs = await Promise.all(entries.map(entryToPng));
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  entries.forEach((entry, index) => {
    if (index > 0 && index % perPage === 0) {
      doc.addPage();
    }

    const slot = index % perPage;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN_MM + col * (cellWidth + GAP_MM);
    const y = MARGIN_MM + row * (cellHeight + GAP_MM);

    // Light cell border for cutting guides
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cellWidth, cellHeight);

    const pad = 3;
    const labelHeight = 7;
    const imgAreaWidth = cellWidth - pad * 2;
    const imgAreaHeight = cellHeight - pad * 2 - labelHeight;
    const png = pngs[index];
    const fitted = fitInside(png.widthPx, png.heightPx, imgAreaWidth, imgAreaHeight);
    const imgX = x + pad + (imgAreaWidth - fitted.width) / 2;
    const imgY = y + pad + (imgAreaHeight - fitted.height) / 2;

    doc.addImage(png.dataUrl, 'PNG', imgX, imgY, fitted.width, fitted.height, undefined, 'FAST');

    doc.setFontSize(LABEL_FONT_PT);
    doc.setTextColor(40);
    const label = entry.label.length > 36 ? `${entry.label.slice(0, 35)}…` : entry.label;
    doc.text(label, x + cellWidth / 2, y + cellHeight - pad - 1, {
      align: 'center',
      baseline: 'bottom'
    });
  });

  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeName);
}
