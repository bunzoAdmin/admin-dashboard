'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { Card } from '@/components/ui';
import { buildPhoneNumber, DEFAULT_COUNTRY_DIAL } from '@/lib/phone';

export default function DriversLookupPage() {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL);
  const [localNumber, setLocalNumber] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = buildPhoneNumber(countryCode, localNumber);
    if (!p) return;
    router.push(`/riders/${encodeURIComponent(p)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Riders</h1>
        <p className="text-sm text-gray-500">Look up a rider by phone number to view their full profile and activity.</p>
      </div>

      <Card className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <span className="label">Driver phone number</span>
          <div className="flex gap-2">
            <PhoneInput
              autoFocus
              className="flex-1"
              countryCode={countryCode}
              localNumber={localNumber}
              onCountryCodeChange={setCountryCode}
              onLocalNumberChange={setLocalNumber}
            />
            <button type="submit" className="btn-primary shrink-0 self-start">
              <Search className="h-4 w-4" />
              Look up
            </button>
          </div>
          <p className="text-xs text-gray-400">Select the country code and enter the mobile number without the leading zero.</p>
        </form>
      </Card>
    </div>
  );
}
