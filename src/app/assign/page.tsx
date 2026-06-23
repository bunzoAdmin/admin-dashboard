'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PackageCheck, ArrowRight } from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { api, ApiClientError } from '@/lib/api';
import { buildPhoneNumber, DEFAULT_COUNTRY_DIAL } from '@/lib/phone';
import { Card, Field, Spinner, ErrorBox, useToast } from '@/components/ui';

export default function AssignPage() {
  const toast = useToast();
  const [orderId, setOrderId] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL);
  const [localNumber, setLocalNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<{ order: string; phone: string } | null>(null);

  const fullPhone = buildPhoneNumber(countryCode, localNumber);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId.trim() || !fullPhone) {
      setError('Both order ID and driver phone are required.');
      return;
    }
    setBusy(true);
    setError(null);
    setAssigned(null);
    try {
      await api.assignOrder(orderId.trim(), fullPhone);
      toast.push('success', `Order assigned to ${fullPhone}.`);
      setAssigned({ order: orderId.trim(), phone: fullPhone });
      setOrderId('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to assign order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Assign order</h1>
        <p className="text-sm text-gray-500">Force-assign a pooled order to a specific on-duty driver.</p>
      </div>

      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorBox message={error} />}
          {assigned && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <PackageCheck className="h-4 w-4" />
              Order <span className="font-mono">{assigned.order}</span> assigned to {assigned.phone}.
            </div>
          )}
          <Field label="Order ID">
            <input className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="order_abc123" autoFocus />
          </Field>
          <Field label="Driver phone" hint="The driver must be on duty (eligible) and not currently busy.">
            <PhoneInput
              countryCode={countryCode}
              localNumber={localNumber}
              onCountryCodeChange={setCountryCode}
              onLocalNumberChange={setLocalNumber}
            />
          </Field>
          <div className="flex items-center justify-between">
            {fullPhone && (
              <Link href={`/drivers/${encodeURIComponent(fullPhone)}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                Check driver status <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <button type="submit" className="btn-primary ml-auto" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Assign order'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
