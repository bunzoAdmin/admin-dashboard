'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { qrApi } from '@/lib/qrApi';
import type { QrCampaign } from '@/lib/qrTypes';
import { Card, Loading, ErrorBox, EmptyState, Badge } from '@/components/ui';

export default function QrCampaignsPage() {
  const [campaigns, setCampaigns] = useState<QrCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await qrApi.listCampaigns());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QR Campaigns</h1>
          <p className="text-sm text-gray-500">Dynamic QR codes for app-download marketing.</p>
        </div>
        <Link href="/qr-campaigns/new" className="btn-primary flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Create Campaign
        </Link>
      </div>

      {loading ? (
        <Loading label="Loading campaigns…" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : campaigns.length === 0 ? (
        <EmptyState>No campaigns yet. Create your first QR campaign to get started.</EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Placements</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <tr key={c.campaign_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/qr-campaigns/${c.campaign_id}`} className="font-medium text-brand-green hover:underline">
                      {c.name}
                    </Link>
                    {c.description && <div className="text-xs text-gray-400">{c.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.placement_slugs?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.enabled ? 'green' : 'gray'}>{c.enabled ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
