'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import JSZip from 'jszip';
import { Plus, Download } from 'lucide-react';
import { qrApi } from '@/lib/qrApi';
import type { QrCampaignDetail, QrPlacement, QrAnalytics } from '@/lib/qrTypes';
import { Card, Loading, ErrorBox, Badge, Stat, useToast } from '@/components/ui';
import { QrCard } from '@/components/qr/QrCard';
import { ScanBars } from '@/components/qr/ScanBars';
import { PlatformPie } from '@/components/qr/PlatformPie';
import { svgElementToPngBlob, downloadBlob, sanitizeFilename } from '@/lib/qrImage';

export default function QrCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();

  const [detail, setDetail] = useState<QrCampaignDetail | null>(null);
  const [analytics, setAnalytics] = useState<QrAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pLoc, setPLoc] = useState('');
  const [adding, setAdding] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a] = await Promise.all([
        qrApi.getCampaign(id),
        qrApi.analytics(id, `${from}T00:00:00Z`, `${to}T23:59:59Z`)
      ]);
      setDetail({ ...d, placements: d.placements ?? [] });
      setAnalytics({
        ...a,
        placements: a.placements ?? [],
        daily: a.daily ?? []
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPlacement(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim()) return;
    setAdding(true);
    try {
      await qrApi.addPlacement(id, { name: pName.trim(), location: pLoc.trim() || undefined });
      setPName('');
      setPLoc('');
      toast.push('success', 'Placement added');
      await load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed to add placement');
    } finally {
      setAdding(false);
    }
  }

  async function toggleCampaign(enabled: boolean) {
    try {
      await qrApi.updateCampaign(id, { enabled });
      toast.push('success', enabled ? 'Campaign enabled' : 'Campaign disabled');
      await load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function togglePlacement(p: QrPlacement) {
    try {
      await qrApi.updatePlacement(id, p.slug, { enabled: !p.enabled });
      await load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed to update placement');
    }
  }

  async function downloadAllZip() {
    if (!detail || !gridRef.current) return;
    const cards = Array.from(gridRef.current.querySelectorAll('[data-qr-svg] svg')) as SVGSVGElement[];
    if (!cards.length) return;
    const zip = new JSZip();
    for (let i = 0; i < detail.placements.length; i++) {
      const svg = cards[i];
      if (!svg) continue;
      const blob = await svgElementToPngBlob(svg, 1024);
      const p = detail.placements[i];
      zip.file(`${sanitizeFilename(p.name)}_${p.slug}.png`, blob);
    }
    const out = await zip.generateAsync({ type: 'blob' });
    downloadBlob(out, `${sanitizeFilename(detail.campaign.name)}_qr_codes.zip`);
  }

  if (loading) return <Loading label="Loading campaign…" />;
  if (error) return <ErrorBox message={error} />;
  if (!detail) return <ErrorBox message="Campaign not found" />;

  const c = detail.campaign;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
          {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Badge tone={c.enabled ? 'green' : 'gray'}>{c.enabled ? 'Active' : 'Disabled'}</Badge>
          <button className="btn-ghost text-sm" onClick={() => toggleCampaign(!c.enabled)}>
            {c.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total scans" value={analytics.total_scans} />
          <Stat label="Unique" value={analytics.total_unique} />
          <Stat label="iOS" value={analytics.total_ios} />
          <Stat label="Android" value={analytics.total_android} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Scans over time</h2>
            <div className="flex items-end gap-2 print:hidden">
              <div>
                <label className="label">From</label>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>
          {analytics ? <ScanBars data={analytics.daily} /> : <div className="text-sm text-gray-400">No data</div>}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Platform split</h2>
          {analytics ? (
            <PlatformPie
              ios={analytics.total_ios}
              android={analytics.total_android}
              other={analytics.total_other}
            />
          ) : (
            <div className="text-sm text-gray-400">No data</div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Scans by placement</h2>
          <p className="text-xs text-gray-500">Lifetime counts per placement (bots excluded from scans/unique).</p>
        </div>
        {(analytics?.placements?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Placement</th>
                  <th className="px-4 py-3 text-right">Scans</th>
                  <th className="px-4 py-3 text-right">Unique</th>
                  <th className="px-4 py-3 text-right">iOS</th>
                  <th className="px-4 py-3 text-right">Android</th>
                  <th className="px-4 py-3 text-right">Other</th>
                  <th className="px-4 py-3 text-right">Bots</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.placements.map((p) => (
                  <tr key={p.slug} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.location && <div className="text-xs text-gray-400">{p.location}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{p.scan_count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.unique_count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.ios_count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.android_count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.other_count}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{p.bot_count}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.enabled ? 'green' : 'gray'}>{p.enabled ? 'Active' : 'Disabled'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{analytics.total_scans}</td>
                  <td className="px-4 py-3 text-right">{analytics.total_unique}</td>
                  <td className="px-4 py-3 text-right">{analytics.total_ios}</td>
                  <td className="px-4 py-3 text-right">{analytics.total_android}</td>
                  <td className="px-4 py-3 text-right">{analytics.total_other}</td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {analytics.placements.reduce((sum, p) => sum + p.bot_count, 0)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-gray-400">No placements yet.</div>
        )}
      </Card>

      {(analytics?.placements?.length ?? 0) > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold text-gray-900">Platform split by placement</h2>
          <p className="mb-4 text-xs text-gray-500">iOS / Android / Other breakdown for each placement.</p>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {analytics.placements.map((p) => (
              <div key={p.slug} className="rounded-lg border border-gray-100 p-3">
                <div className="mb-2 min-w-0">
                  <div className="truncate font-medium text-gray-900">{p.name}</div>
                  {p.location && <div className="truncate text-xs text-gray-400">{p.location}</div>}
                </div>
                <PlatformPie ios={p.ios_count} android={p.android_count} other={p.other_count} size={120} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Add placement</h2>
        <form onSubmit={addPlacement} className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="label">Name</label>
            <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Manda Hill entrance" required />
          </div>
          <div className="flex-1">
            <label className="label">Location (optional)</label>
            <input className="input" value={pLoc} onChange={(e) => setPLoc(e.target.value)} placeholder="e.g. Lusaka" />
          </div>
          <button type="submit" className="btn-primary flex items-center gap-1.5" disabled={adding}>
            <Plus className="h-4 w-4" /> {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Placements ({detail.placements.length})</h2>
        {detail.placements.length > 0 && (
          <button className="btn-ghost flex items-center gap-1.5 text-sm print:hidden" onClick={downloadAllZip}>
            <Download className="h-4 w-4" /> Download all (ZIP)
          </button>
        )}
      </div>

      <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {detail.placements.map((p) => (
          <div key={p.slug} className="space-y-2">
            <QrCard placement={p} />
            <div className="flex items-center justify-between px-1 text-xs print:hidden">
              <span className="text-gray-500">{p.scan_count} scans · {p.unique_count} unique</span>
              <button className="text-brand-green hover:underline" onClick={() => togglePlacement(p)}>
                {p.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
