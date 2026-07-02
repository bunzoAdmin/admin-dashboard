'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Printer, RefreshCw } from 'lucide-react';
import { catalogApi, CatalogApiError } from '@/lib/catalogApi';
import type { PagedBarcodeResponse } from '@/lib/catalogTypes';
import { BarcodeSvg } from '@/components/barcode-generator/BarcodeSvg';
import { formatBarcodeDate } from '@/components/barcode-generator/barcodeUtils';
import { ErrorBox, Loading } from '@/components/ui';

const PAGE_SIZE = 20;

export default function BarcodeListPage() {
  const [listData, setListData] = useState<PagedBarcodeResponse | null>(null);
  const [listPage, setListPage] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(async (page: number) => {
    setListLoading(true);
    setListError(null);
    try {
      setListData(await catalogApi.listBarcodes({ page, size: PAGE_SIZE }));
    } catch (err) {
      setListError(err instanceof CatalogApiError ? err.message : 'Failed to load barcodes.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(0);
  }, [loadList]);

  function handlePageChange(p: number) {
    setListPage(p);
    loadList(p);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">List of Barcodes</h1>
          <p className="text-sm text-gray-500">
            All internally generated EAN-13 barcodes for unbranded products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => loadList(listPage)}
            disabled={listLoading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/barcode-generator/generate" className="btn-primary text-sm">
            Generate new
          </Link>
        </div>
      </div>

      {listError && <ErrorBox message={listError} />}
      {listLoading && !listData && <Loading label="Loading barcodes…" />}

      {listData && (
        <>
          {listData.content.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No barcodes generated yet.{' '}
              <Link href="/barcode-generator/generate" className="text-blue-600 hover:underline">
                Generate your first barcode
              </Link>
              .
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Barcode preview</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Label</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Unit</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Multipack</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Format</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listData.content.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="w-32">
                          <BarcodeSvg value={entry.barcode} format={entry.format} height={44} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{entry.productName}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.contentAmount}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.contentUom}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {entry.multipackCount != null && entry.multipackCount > 1 ? (
                          `× ${entry.multipackCount}`
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{entry.format}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                        {formatBarcodeDate(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {listData.totalPages > 1 && (
            <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
              <span>
                {listData.totalElements} barcode{listData.totalElements !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost p-1"
                  disabled={listData.first}
                  onClick={() => handlePageChange(listPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2">
                  Page {listData.page + 1} of {listData.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-ghost p-1"
                  disabled={listData.last}
                  onClick={() => handlePageChange(listPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
