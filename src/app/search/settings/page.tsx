'use client';

import { useCallback, useEffect, useState } from 'react';
import { searchAdminApi, SearchAdminApiError } from '@/lib/searchAdminApi';
import type { SearchSetting } from '@/lib/searchAdminTypes';
import { Card, EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { RefreshCw } from 'lucide-react';

export default function SearchSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SearchSetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchAdminApi.listSettings();
      setSettings(data);
      const d: Record<string, string> = {};
      data.forEach(s => { d[s.key] = s.value; });
      setDrafts(d);
    } catch (err) {
      setError(err instanceof SearchAdminApiError ? err.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(key: string) {
    const value = drafts[key];
    if (value === undefined) return;
    setSaving(key);
    try {
      await searchAdminApi.upsertSetting({ key, value });
      setSettings(prev => prev?.map(s => s.key === key ? { ...s, value } : s) ?? null);
      toast.push('success', `Setting "${key}" saved.`);
    } catch (err) {
      toast.push('error', err instanceof SearchAdminApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await searchAdminApi.syncConfig();
      toast.push('success', 'Settings pushed to Meilisearch.');
    } catch (err) {
      toast.push('error', err instanceof SearchAdminApiError ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Search Settings</h1>
          <p className="text-sm text-gray-500">Key-value configuration for Meilisearch behaviour.</p>
        </div>
        <button
          className="btn-primary flex items-center gap-1 text-sm"
          disabled={syncing}
          onClick={handleSync}
        >
          {syncing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Push to Meilisearch
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && settings === null ? (
          <div className="p-6"><Loading label="Loading settings…" /></div>
        ) : settings && settings.length === 0 ? (
          <EmptyState>No settings configured.</EmptyState>
        ) : settings ? (
          <div className="divide-y divide-gray-50">
            {settings.map(s => (
              <div key={s.key} className="flex items-center gap-4 px-4 py-3">
                <div className="w-48 shrink-0">
                  <p className="font-mono text-xs font-semibold text-gray-700">{s.key}</p>
                  {s.description && <p className="text-xs text-gray-400">{s.description}</p>}
                </div>
                <input
                  className="input flex-1"
                  value={drafts[s.key] ?? s.value}
                  onChange={e => setDrafts(d => ({ ...d, [s.key]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={saving === s.key || drafts[s.key] === s.value}
                  onClick={() => handleSave(s.key)}
                >
                  {saving === s.key ? <Spinner className="h-4 w-4" /> : 'Save'}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
