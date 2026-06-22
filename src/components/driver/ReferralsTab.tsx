'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { ReferralScreen } from '@/lib/types';
import { Badge, Card, EmptyState, ErrorBox, Loading, Stat, formatDate, money } from '@/components/ui';

function referralTone(status: string): 'green' | 'amber' | 'gray' | 'red' {
  const s = status.toLowerCase();
  if (s.includes('paid') || s.includes('complete') || s.includes('triggered')) return 'green';
  if (s.includes('pending') || s.includes('progress')) return 'amber';
  if (s.includes('expired') || s.includes('failed')) return 'red';
  return 'gray';
}

export function ReferralsTab({ phone }: { phone: string }) {
  const [data, setData] = useState<ReferralScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDriverReferrals(phone));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load referrals.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading referrals…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Referral code" value={<span className="font-mono">{data.referral_code || '—'}</span>} />
        <Stat label="Total reward earned" value={money(data.reward_zmw)} />
      </div>

      <Card className="p-0">
        {data.referrals.length === 0 ? (
          <div className="p-5">
            <EmptyState>This driver hasn&apos;t referred anyone yet.</EmptyState>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Referred driver</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Window expires</th>
              </tr>
            </thead>
            <tbody>
              {data.referrals.map((r) => (
                <tr key={r.referred_de_id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-700">{r.referred_name || r.referred_de_id}</td>
                  <td className="px-5 py-3">
                    <Badge tone={referralTone(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(r.created_at)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(r.window_expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
