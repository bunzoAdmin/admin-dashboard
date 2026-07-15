'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { qrApi } from '@/lib/qrApi';
import { Card, ErrorBox } from '@/components/ui';

export default function NewQrCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const c = await qrApi.createCampaign({ name: name.trim(), description: description.trim() || undefined });
      router.replace(`/qr-campaigns/${c.campaign_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create campaign');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create QR Campaign</h1>
        <p className="text-sm text-gray-500">Add placements and download QR codes after creating.</p>
      </div>
      <Card className="p-6">
        {error && <ErrorBox message={error} />}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Campaign name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backlit box" required />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Creating…' : 'Create campaign'}
          </button>
        </form>
      </Card>
    </div>
  );
}
