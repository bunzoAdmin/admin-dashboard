'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui';

export default function DriversLookupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let p = phone.trim();
    if (!p) return;
    if (!p.startsWith('+')) p = '+' + p.replace(/^\+*/, '');
    router.push(`/drivers/${encodeURIComponent(p)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Drivers</h1>
        <p className="text-sm text-gray-500">Look up a driver by phone number to view their full profile and activity.</p>
      </div>

      <Card className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <span className="label">Driver phone number</span>
          <div className="flex gap-2">
            <input
              autoFocus
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+260970000000"
              inputMode="tel"
            />
            <button type="submit" className="btn-primary shrink-0">
              <Search className="h-4 w-4" />
              Look up
            </button>
          </div>
          <p className="text-xs text-gray-400">Enter the full number including country code. The leading + is optional.</p>
        </form>
      </Card>
    </div>
  );
}
