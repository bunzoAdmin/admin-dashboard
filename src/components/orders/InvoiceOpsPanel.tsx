'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { orderAdminApi, OrderAdminApiError } from '@/lib/orderAdminApi';
import type { OrderResponse } from '@/lib/orderAdminTypes';
import { Badge, Spinner, useToast } from '@/components/ui';
import { useAuth } from '@/lib/store';
import { zraApi, ZraApiError } from '@/lib/zraApi';
import { isZraFinanceAdmin } from '@/lib/zraFinance';

type InvoiceInfo = NonNullable<OrderResponse['invoice']>;

interface InvoiceOpsPanelProps {
  orderNumber: string;
  invoice?: InvoiceInfo | null;
  onUpdated?: (invoice: InvoiceInfo) => void;
  compact?: boolean;
}

function invoiceStatusTone(status?: string | null): 'gray' | 'green' | 'amber' | 'red' | 'blue' {
  switch (status) {
    case 'ISSUED': return 'green';
    case 'FAILED': return 'red';
    case 'PENDING': return 'amber';
    case 'SKIPPED': return 'gray';
    default: return 'blue';
  }
}

export function InvoiceOpsPanel({ orderNumber, invoice, onUpdated, compact = false }: InvoiceOpsPanelProps) {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [viewingPdf, setViewingPdf] = useState(false);
  const [crediting, setCrediting] = useState(false);

  const canFinance = isZraFinanceAdmin(user);
  const statusLabel = invoice?.status ?? 'MISSING';
  const canRetry = statusLabel !== 'ISSUED';
  const canViewPdf = invoice?.available === true;
  const canCredit = statusLabel === 'ISSUED' && canFinance;

  async function handleDownloadPdf() {
    setViewingPdf(true);
    try {
      const blobUrl = await orderAdminApi.fetchInvoicePdfBlobUrl(orderNumber);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `invoice-${orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      toast.push('error', err instanceof OrderAdminApiError ? err.message : 'Could not download PDF.');
    } finally {
      setViewingPdf(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const updated = await orderAdminApi.uploadInvoice(orderNumber, file);
      onUpdated?.(updated);
      toast.push('success', 'Invoice PDF uploaded.');
    } catch (err) {
      toast.push('error', err instanceof OrderAdminApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const updated = await orderAdminApi.retryInvoice(orderNumber);
      onUpdated?.(updated);
      toast.push('success', 'ZRA invoice issued successfully.');
    } catch (err) {
      toast.push('error', err instanceof OrderAdminApiError ? err.message : 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleCreditNote() {
    if (
      !window.confirm(
        `Issue a full ZRA credit note for order ${orderNumber}? This writes to Smart Invoice and cannot be undone.`
      )
    ) {
      return;
    }
    setCrediting(true);
    try {
      const cn = await zraApi.issueCreditNote(
        orderNumber,
        { reasonCd: '01', reason: 'Customer return / refund', fullCredit: true },
        user?.username
      );
      toast.push('success', `Credit note ${cn.status ?? 'submitted'} (invc ${cn.id}).`);
    } catch (err) {
      toast.push('error', err instanceof ZraApiError ? err.message : 'Credit note failed.');
    } finally {
      setCrediting(false);
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={invoiceStatusTone(invoice?.status)}>{statusLabel}</Badge>
        {invoice?.available && invoice.receiptNumber && (
          <span className="text-xs text-gray-500">Rcpt {invoice.receiptNumber}</span>
        )}
      </div>

      {invoice?.lastError && (
        <p className="text-xs text-red-600 break-words">{invoice.lastError}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canViewPdf && (
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={viewingPdf}
            onClick={() => void handleDownloadPdf()}
          >
            {viewingPdf ? <Spinner className="h-3 w-3" /> : 'Download PDF'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Spinner className="h-3 w-3" /> : invoice?.available ? 'Replace PDF' : 'Upload PDF'}
        </button>
        {canRetry && (
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={retrying}
            onClick={() => void handleRetry()}
          >
            {retrying ? <Spinner className="h-3 w-3" /> : 'Retry ZRA'}
          </button>
        )}
        {statusLabel === 'ISSUED' && canFinance && (
          <button
            type="button"
            className="btn-ghost text-xs text-red-700"
            disabled={crediting}
            onClick={() => void handleCreditNote()}
            title="Finance admin only"
          >
            {crediting ? <Spinner className="h-3 w-3" /> : 'Issue credit note'}
          </button>
        )}
        {!compact && (
          <Link href={`/orders/${orderNumber}`} className="btn-ghost text-xs">
            Order detail
          </Link>
        )}
      </div>
    </div>
  );
}
