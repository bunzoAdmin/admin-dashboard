'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Printer } from 'lucide-react';
import { catalogApi } from '@/lib/catalogApi';
import type { CategoryTreeNode } from '@/lib/catalogTypes';
import { BarcodeCard } from '@/components/barcode-generator/BarcodeCard';
import { GenerateBarcodeForm } from '@/components/barcode-generator/GenerateBarcodeForm';
import { GenerateRackBarcodeForm } from '@/components/barcode-generator/GenerateRackBarcodeForm';
import { downloadBarcodesPdf } from '@/components/barcode-generator/barcodePdf';
import type { BarcodeDisplayEntry } from '@/components/barcode-generator/barcodeUtils';
import { ErrorBox, Spinner } from '@/components/ui';

type GenerateTab = 'product' | 'rack';

export default function GenerateBarcodePage() {
  const [tab, setTab] = useState<GenerateTab>('product');
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [freshBarcodes, setFreshBarcodes] = useState<BarcodeDisplayEntry[]>([]);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await catalogApi.getCategoryTree());
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function handleProductGenerated(entry: BarcodeDisplayEntry) {
    setFreshBarcodes((prev) => {
      const without = prev.filter((b) => b.key !== entry.key);
      return [entry, ...without];
    });
  }

  function handleRackGenerated(entries: BarcodeDisplayEntry[]) {
    setFreshBarcodes((prev) => {
      const keys = new Set(entries.map((e) => e.key));
      const without = prev.filter((b) => !keys.has(b.key));
      return [...entries, ...without];
    });
  }

  async function handleDownloadPdf() {
    if (freshBarcodes.length === 0 || pdfDownloading) return;
    setPdfDownloading(true);
    setPdfError(null);
    try {
      const rackCount = freshBarcodes.filter((b) => b.kind === 'rack').length;
      const filename =
        rackCount === freshBarcodes.length
          ? `rack-barcodes-${freshBarcodes.length}.pdf`
          : `barcodes-${freshBarcodes.length}.pdf`;
      await downloadBarcodesPdf(freshBarcodes, filename);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to build PDF.');
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Generate New</h1>
          <p className="text-sm text-gray-500">
            Print or download CODE128 shelf labels for warehouse auditing. Paste location codes
            manually for new racks, or load locations with stock history to reprint. Product barcodes
            (EAN-13) are saved separately in the list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/audit" className="btn-ghost text-sm">
            Location audit
          </Link>
          <Link href="/barcode-generator/list" className="btn-ghost text-sm">
            Product barcodes
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'product'
              ? 'border-brand-green text-brand-green-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('product')}
        >
          Product barcode
        </button>
        <button
          type="button"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'rack'
              ? 'border-brand-green text-brand-green-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('rack')}
        >
          Rack label
        </button>
      </div>

      {tab === 'product' ? (
        <GenerateBarcodeForm categories={categories} onGenerated={handleProductGenerated} />
      ) : (
        <Suspense fallback={null}>
          <GenerateRackBarcodeForm onGenerated={handleRackGenerated} />
        </Suspense>
      )}

      {freshBarcodes.length > 0 && (
        <section className="space-y-3 print:block">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <h2 className="text-base font-semibold text-gray-900">
              Generated this session ({freshBarcodes.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost flex items-center gap-1.5 text-sm"
                disabled={pdfDownloading}
                onClick={handleDownloadPdf}
              >
                {pdfDownloading ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {pdfDownloading ? 'Building PDF…' : 'Download PDF'}
              </button>
              <button
                type="button"
                className="btn-ghost flex items-center gap-1.5 text-sm"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" /> Print labels
              </button>
            </div>
          </div>
          {pdfError && <ErrorBox message={pdfError} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {freshBarcodes.map((entry) => (
              <BarcodeCard key={entry.key} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
