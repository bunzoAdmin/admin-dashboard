'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { catalogApi } from '@/lib/catalogApi';
import type { BarcodeEntryResponse, CategoryTreeNode } from '@/lib/catalogTypes';
import { BarcodeCard } from '@/components/barcode-generator/BarcodeCard';
import { GenerateBarcodeForm } from '@/components/barcode-generator/GenerateBarcodeForm';

export default function GenerateBarcodePage() {
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [freshBarcodes, setFreshBarcodes] = useState<BarcodeEntryResponse[]>([]);

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

  function handleGenerated(entry: BarcodeEntryResponse) {
    setFreshBarcodes((prev) => {
      const without = prev.filter((b) => b.productName !== entry.productName);
      return [entry, ...without];
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Generate New</h1>
          <p className="text-sm text-gray-500">
            Create an EAN-13 barcode for fruits, vegetables, and other products without a vendor
            barcode. One barcode per size — e.g. Tomato 500G and Tomato 1KG are separate. Print the
            label, stick it on the product, then scan on Catalog → Products to create the entry.
          </p>
        </div>
        <Link href="/barcode-generator/list" className="btn-ghost text-sm">
          View all barcodes
        </Link>
      </div>

      <GenerateBarcodeForm categories={categories} onGenerated={handleGenerated} />

      {freshBarcodes.length > 0 && (
        <section className="space-y-3 print:block">
          <div className="flex items-center justify-between print:hidden">
            <h2 className="text-base font-semibold text-gray-900">
              Generated this session ({freshBarcodes.length})
            </h2>
            <button
              type="button"
              className="btn-ghost flex items-center gap-1.5 text-sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print labels
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {freshBarcodes.map((entry) => (
              <BarcodeCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
